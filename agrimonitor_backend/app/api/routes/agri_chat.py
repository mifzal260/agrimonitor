import json
import logging
from collections.abc import AsyncIterator

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse

from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.agri_chat import AgriChatRequest, AgriChatStatus
from app.services.agri_chat import get_ollama_status, stream_chat_response

logger = logging.getLogger("agrimonitor.agri_chat")
router = APIRouter()


@router.get("/status", response_model=AgriChatStatus)
async def read_agri_chat_status(
    _: User = Depends(get_current_user),
) -> AgriChatStatus:
    return AgriChatStatus(**(await get_ollama_status()))


@router.post("/chat")
async def chat_with_agri_assistant(
    payload: AgriChatRequest,
    _: User = Depends(get_current_user),
) -> StreamingResponse:
    ollama_status = await get_ollama_status()
    if not ollama_status["available"]:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=ollama_status["message"],
        )

    async def events() -> AsyncIterator[str]:
        try:
            async for content in stream_chat_response(payload.messages):
                yield json.dumps({"content": content}, ensure_ascii=False) + "\n"
            yield json.dumps({"done": True}) + "\n"
        except RuntimeError as exc:
            yield json.dumps({"error": str(exc)}, ensure_ascii=False) + "\n"

    return StreamingResponse(
        events(),
        media_type="application/x-ndjson",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
