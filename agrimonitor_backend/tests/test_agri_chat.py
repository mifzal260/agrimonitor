import asyncio
import json

import pytest
from fastapi.testclient import TestClient

from app.schemas.agri_chat import AgriChatMessage
from app.services import agri_chat


def register_user(client: TestClient) -> str:
    response = client.post(
        "/api/v1/auth/register",
        json={"name": "Chat Tester", "email": "chat@example.com", "password": "password123"},
    )
    assert response.status_code == 201
    return response.json()["access_token"]


def auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_agri_chat_status_requires_authentication(client: TestClient) -> None:
    response = client.get("/api/v1/agri-chat/status")

    assert response.status_code == 401


def test_agri_chat_reports_unavailable_model(client: TestClient, monkeypatch) -> None:
    token = register_user(client)
    monkeypatch.setattr(
        "app.api.routes.agri_chat.get_deepseek_status",
        lambda: _async_result(
            {
                "available": False,
                "model": "deepseek-flash",
                "message": "Model 'deepseek-flash' is unavailable from the DeepSeek API.",
            }
        ),
    )

    status_response = client.get("/api/v1/agri-chat/status", headers=auth_header(token))
    chat_response = client.post(
        "/api/v1/agri-chat/chat",
        headers=auth_header(token),
        json={"messages": [{"role": "user", "content": "Daun cili kuning"}]},
    )

    assert status_response.status_code == 200
    assert status_response.json()["available"] is False
    assert chat_response.status_code == 503
    assert "DeepSeek API" in chat_response.json()["detail"]


def test_agri_chat_streams_assistant_chunks(client: TestClient, monkeypatch) -> None:
    token = register_user(client)
    monkeypatch.setattr(
        "app.api.routes.agri_chat.get_deepseek_status",
        lambda: _async_result(
            {"available": True, "model": "deepseek-flash", "message": "Ready"}
        ),
    )

    async def fake_stream(_messages):
        yield "Periksa saliran. "
        yield "Berapa umur pokok?"

    monkeypatch.setattr("app.api.routes.agri_chat.stream_chat_response", fake_stream)
    response = client.post(
        "/api/v1/agri-chat/chat",
        headers=auth_header(token),
        json={"messages": [{"role": "user", "content": "Daun cili kuning"}]},
    )

    events = [json.loads(line) for line in response.text.splitlines()]
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/x-ndjson")
    assert events == [
        {"content": "Periksa saliran. "},
        {"content": "Berapa umur pokok?"},
        {"done": True},
    ]


def test_deepseek_status_checks_configured_model(monkeypatch) -> None:
    captured_request = {}

    class FakeResponse:
        status_code = 200

        def raise_for_status(self):
            return None

        def json(self):
            return {"object": "list", "data": [{"id": "deepseek-flash"}]}

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        async def get(self, url, *, headers):
            captured_request.update({"url": url, "headers": headers})
            return FakeResponse()

    monkeypatch.setattr(agri_chat.settings, "deepseek_api_key", "test-api-key")
    monkeypatch.setattr(agri_chat.httpx, "AsyncClient", lambda **_kwargs: FakeClient())

    status = asyncio.run(agri_chat.get_deepseek_status())

    assert status == {
        "available": True,
        "model": "deepseek-flash",
        "message": "AI assistant is ready.",
    }
    assert captured_request == {
        "url": "https://api.deepseek.com/models",
        "headers": {"Authorization": "Bearer test-api-key"},
    }


def test_deepseek_stream_uses_only_latest_ten_messages_and_limits_output(monkeypatch) -> None:
    captured_payload = {}

    class FakeResponse:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        def raise_for_status(self):
            return None

        async def aiter_lines(self):
            yield ": keep-alive"
            yield "data: " + json.dumps({"choices": [{"delta": {"reasoning_content": "Internal"}}]})
            yield "data: " + json.dumps({"choices": [{"delta": {"content": "Jawapan ringkas"}}]})
            yield "data: [DONE]"

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        def stream(self, _method, _url, *, json, **_kwargs):
            captured_payload.update(json)
            return FakeResponse()

    monkeypatch.setattr(agri_chat.httpx, "AsyncClient", lambda **_kwargs: FakeClient())
    messages = [
        AgriChatMessage(role="user", content=f"Soalan {index}")
        for index in range(12)
    ]

    async def collect():
        return [chunk async for chunk in agri_chat.stream_chat_response(messages)]

    assert asyncio.run(collect()) == ["Jawapan ringkas"]
    assert len(captured_payload["messages"]) == 11
    assert captured_payload["messages"][0]["role"] == "system"
    assert captured_payload["messages"][1]["content"] == "Soalan 2"
    assert captured_payload["model"] == agri_chat.settings.deepseek_model
    assert captured_payload["thinking"] == {"type": "enabled"}
    assert captured_payload["reasoning_effort"] == agri_chat.settings.deepseek_reasoning_effort
    assert captured_payload["max_tokens"] == agri_chat.settings.deepseek_max_tokens


@pytest.mark.parametrize(
    "chunks",
    [
        ["data: [DONE]"],
        ["data: " + json.dumps({"choices": [{"delta": {"content": "Partial answer"}}]})],
    ],
)
def test_deepseek_stream_rejects_empty_or_incomplete_response(monkeypatch, chunks) -> None:
    class FakeResponse:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        def raise_for_status(self):
            return None

        async def aiter_lines(self):
            for chunk in chunks:
                yield chunk

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        def stream(self, *_args, **_kwargs):
            return FakeResponse()

    monkeypatch.setattr(agri_chat.httpx, "AsyncClient", lambda **_kwargs: FakeClient())

    async def collect():
        return [chunk async for chunk in agri_chat.stream_chat_response(
            [AgriChatMessage(role="user", content="Soalan ujian")]
        )]

    with pytest.raises(RuntimeError, match="response was interrupted"):
        asyncio.run(collect())


def _async_result(value):
    async def return_value():
        return value

    return return_value()
