import json
import logging
from collections.abc import AsyncIterator
from typing import Any

import httpx

from app.core.config import settings
from app.schemas.agri_chat import AgriChatMessage

logger = logging.getLogger("agrimonitor.agri_chat")

SYSTEM_PROMPT = (
    "Anda pembantu pertanian yang mesra dan praktikal untuk petani di Malaysia. "
    "Jawab dalam bahasa pengguna (utamakan Bahasa Melayu mudah). Beri jawapan ringkas, "
    "langkah demi langkah, dan sesuai dengan iklim tropika Malaysia. Jika maklumat tidak "
    "mencukupi untuk diagnosis, tanya satu soalan susulan (contoh: jenis tanaman, umur, "
    "gejala, cuaca). Untuk racun perosak dan baja kimia, sebut keselamatan asas "
    "(pakaian pelindung, dos mengikut label, tempoh sebelum tuai) dan cadangkan kaedah "
    "organik atau IPM dahulu jika boleh. Jangan reka fakta; jika tidak pasti, katakan "
    "begitu dan cadangkan berjumpa pegawai pertanian (contoh: Jabatan Pertanian atau "
    "MARDI). Elak jawapan terlalu panjang."
)


def _headers() -> dict[str, str]:
    api_key = (settings.ollama_api_key or "").strip()
    return {"Authorization": f"Bearer {api_key}"} if api_key else {}


def _model_names(payload: dict[str, Any]) -> set[str]:
    models = payload.get("models")
    if not isinstance(models, list):
        return set()
    return {
        name
        for item in models
        if isinstance(item, dict)
        for name in (item.get("name"), item.get("model"))
        if isinstance(name, str)
    }


async def get_ollama_status() -> dict[str, str | bool]:
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.get(
                f"{settings.ollama_base_url}/api/tags",
                headers=_headers(),
            )
        if response.status_code in {401, 403}:
            return {
                "available": False,
                "model": settings.ollama_model,
                "message": "Ollama access was denied. Check the configured OLLAMA_API_KEY.",
            }
        response.raise_for_status()
        payload = response.json()
    except (httpx.HTTPError, ValueError):
        logger.warning("ollama_status_unavailable", exc_info=True)
        return {
            "available": False,
            "model": settings.ollama_model,
            "message": "AI service is unavailable. Check the configured Ollama endpoint.",
        }

    if not isinstance(payload, dict) or settings.ollama_model not in _model_names(payload):
        return {
            "available": False,
            "model": settings.ollama_model,
            "message": (
                f"Model '{settings.ollama_model}' is not installed on the Ollama server. "
                f"Run 'ollama pull {settings.ollama_model}' on that server."
            ),
        }
    return {
        "available": True,
        "model": settings.ollama_model,
        "message": "AI assistant is ready.",
    }


async def stream_chat_response(
    messages: list[AgriChatMessage],
) -> AsyncIterator[str]:
    recent_messages = messages[-10:]
    ollama_messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        *[message.model_dump() for message in recent_messages],
    ]
    payload = {
        "model": settings.ollama_model,
        "messages": ollama_messages,
        "stream": True,
        "think": False,
        "options": {
            "temperature": settings.ollama_temperature,
            "num_ctx": settings.ollama_num_ctx,
            "num_predict": settings.ollama_num_predict,
        },
    }

    try:
        timeout = httpx.Timeout(connect=8, read=180, write=30, pool=8)
        received_content = False
        completed = False
        async with httpx.AsyncClient(timeout=timeout) as client:
            async with client.stream(
                "POST",
                f"{settings.ollama_base_url}/api/chat",
                headers=_headers(),
                json=payload,
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line:
                        continue
                    chunk = json.loads(line)
                    if not isinstance(chunk, dict):
                        raise ValueError("Ollama returned an invalid response")
                    if "error" in chunk:
                        raise ValueError("Ollama returned a generation error")
                    message = chunk.get("message")
                    content = message.get("content", "") if isinstance(message, dict) else ""
                    if content:
                        received_content = True
                        yield content
                    if chunk.get("done"):
                        completed = True
                        break
        if not completed:
            raise ValueError("Ollama stream ended before completion")
        if not received_content:
            raise ValueError("Ollama returned an empty response")
    except (httpx.HTTPError, json.JSONDecodeError, ValueError) as exc:
        logger.warning("ollama_chat_stream_failed", exc_info=True)
        raise RuntimeError(
            "The AI response was interrupted. Check the Ollama service and try again."
        ) from exc
