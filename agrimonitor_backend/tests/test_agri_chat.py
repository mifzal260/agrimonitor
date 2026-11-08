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


def test_agri_chat_reports_missing_model(client: TestClient, monkeypatch) -> None:
    token = register_user(client)
    monkeypatch.setattr(
        "app.api.routes.agri_chat.get_ollama_status",
        lambda: _async_result(
            {
                "available": False,
                "model": "qwen2.5:7b",
                "message": "Run 'ollama pull qwen2.5:7b' on that server.",
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
    assert "ollama pull" in chat_response.json()["detail"]


def test_agri_chat_streams_assistant_chunks(client: TestClient, monkeypatch) -> None:
    token = register_user(client)
    monkeypatch.setattr(
        "app.api.routes.agri_chat.get_ollama_status",
        lambda: _async_result(
            {"available": True, "model": "qwen2.5:7b", "message": "Ready"}
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


def test_ollama_stream_uses_only_latest_ten_messages_and_limits_output(monkeypatch) -> None:
    captured_payload = {}

    class FakeResponse:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_args):
            return None

        def raise_for_status(self):
            return None

        async def aiter_lines(self):
            yield json.dumps({"message": {"content": "Jawapan ringkas"}, "done": False})
            yield json.dumps({"done": True})

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
    assert captured_payload["think"] is False
    assert captured_payload["options"] == {
        "temperature": agri_chat.settings.ollama_temperature,
        "num_ctx": agri_chat.settings.ollama_num_ctx,
        "num_predict": agri_chat.settings.ollama_num_predict,
    }


@pytest.mark.parametrize(
    "chunks",
    [
        [json.dumps({"done": True})],
        [json.dumps({"message": {"content": "Partial answer"}, "done": False})],
    ],
)
def test_ollama_stream_rejects_empty_or_incomplete_response(monkeypatch, chunks) -> None:
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
