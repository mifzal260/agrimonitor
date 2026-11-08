from typing import Literal

from pydantic import BaseModel, Field, field_validator


class AgriChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4_000)

    @field_validator("content")
    @classmethod
    def require_nonempty_content(cls, value: str) -> str:
        content = value.strip()
        if not content:
            raise ValueError("Message cannot be empty")
        return content


class AgriChatRequest(BaseModel):
    messages: list[AgriChatMessage] = Field(min_length=1, max_length=50)


class AgriChatStatus(BaseModel):
    available: bool
    model: str
    message: str
