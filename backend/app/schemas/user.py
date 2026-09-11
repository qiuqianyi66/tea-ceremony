"""用户认证 schema。"""

from pydantic import BaseModel, ConfigDict


class UserCreate(BaseModel):
    username: str
    password: str
    display_name: str | None = None


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    display_name: str | None = None
    level: int
    xp: int
    preferred_type: str | None = None
    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
