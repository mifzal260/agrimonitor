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
    api_key = (settings.deepseek_api_key or "").strip()
    return {"Authorization": f"Bearer {api_key}"} if api_key else {}


def _model_names(payload: dict[str, Any]) -> set[str]:
    models = payload.get("data")
    if not isinstance(models, list):
        return set()
    return {
        name
        for item in models
        if isinstance(item, dict)
        for name in (item.get("id"),)
        if isinstance(name, str)
    }


async def get_deepseek_status() -> dict[str, str | bool]:
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.get(
                f"{settings.deepseek_base_url}/models",
                headers=_headers(),
            )
        if response.status_code in {401, 403}:
            return {
                "available": False,
                "model": settings.deepseek_model,
                "message": "DeepSeek access was denied. Check the configured DEEPSEEK_API_KEY.",
            }
        response.raise_for_status()
        payload = response.json()
    except (httpx.HTTPError, ValueError):
        logger.warning("deepseek_status_unavailable", exc_info=True)
        return {
            "available": False,
            "model": settings.deepseek_model,
            "message": "AI service is unavailable. Check the configured DeepSeek endpoint.",
        }

    if not isinstance(payload, dict) or settings.deepseek_model not in _model_names(payload):
        return {
            "available": False,
            "model": settings.deepseek_model,
            "message": f"Model '{settings.deepseek_model}' is unavailable from the DeepSeek API.",
        }
    return {
        "available": True,
        "model": settings.deepseek_model,
        "message": "AI assistant is ready.",
    }


async def stream_chat_response(
    messages: list[AgriChatMessage],
) -> AsyncIterator[str]:
    recent_messages = messages[-10:]
    deepseek_messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        *[message.model_dump() for message in recent_messages],
    ]
    payload = {
        "model": settings.deepseek_model,
        "messages": deepseek_messages,
        "stream": True,
        "thinking": {"type": "enabled"},
        "reasoning_effort": settings.deepseek_reasoning_effort,
        "max_tokens": settings.deepseek_max_tokens,
    }

    try:
        timeout = httpx.Timeout(connect=8, read=180, write=30, pool=8)
        received_content = False
        completed = False
        async with httpx.AsyncClient(timeout=timeout) as client:
            async with client.stream(
                "POST",
                f"{settings.deepseek_base_url}/chat/completions",
                headers=_headers(),
                json=payload,
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line or line.startswith(":") or line.startswith("event:"):
                        continue
                    if not line.startswith("data:"):
                        raise ValueError("DeepSeek returned an invalid streaming event")
                    data = line.removeprefix("data:").strip()
                    if data == "[DONE]":
                        completed = True
                        break
                    chunk = json.loads(data)
                    if not isinstance(chunk, dict):
                        raise ValueError("DeepSeek returned an invalid response")
                    if "error" in chunk:
                        raise ValueError("DeepSeek returned a generation error")
                    choices = chunk.get("choices")
                    choice = choices[0] if isinstance(choices, list) and choices else None
                    delta = choice.get("delta") if isinstance(choice, dict) else None
                    content = delta.get("content", "") if isinstance(delta, dict) else ""
                    if content:
                        received_content = True
                        yield content
        if not completed:
            raise ValueError("DeepSeek stream ended before completion")
        if not received_content:
            raise ValueError("DeepSeek returned an empty response")
    except (httpx.HTTPError, json.JSONDecodeError, ValueError) as exc:
        logger.warning("deepseek_chat_stream_failed", exc_info=True)
        raise RuntimeError(
            "The AI response was interrupted. Check the DeepSeek service and try again."
        ) from exc
