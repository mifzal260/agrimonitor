from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.core.security import validate_password_length


class UserBase(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr


class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)

    model_config = ConfigDict(extra="forbid")

    @field_validator("password")
    @classmethod
    def require_bcrypt_compatible_password(cls, value: str) -> str:
        return validate_password_length(value)


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserRead(UserBase):
    id: int
    role: str

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead
    refresh_token: str
    expires_in: int
    refresh_expires_in: int


class RefreshTokenRequest(BaseModel):
    refresh_token: str = Field(min_length=32, max_length=512)

    model_config = ConfigDict(extra="forbid")


class PasswordChangeRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)

    model_config = ConfigDict(extra="forbid")

    @field_validator("new_password")
    @classmethod
    def require_bcrypt_compatible_password(cls, value: str) -> str:
        return validate_password_length(value)
