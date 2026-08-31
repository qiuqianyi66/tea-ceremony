"""
Pydantic 数据验证模型 — V2.0
"""

from datetime import datetime
from pydantic import BaseModel, Field
from typing import Optional


class TeaBase(BaseModel):
    name: str
    category: str
    origin: Optional[str] = None
    region_id: Optional[int] = None
    process_id: Optional[int] = None
    season: Optional[str] = None
    grade: Optional[str] = None
    best_temp: Optional[int] = None
    best_time: Optional[int] = None
    flavor: list[str] = []
    story: Optional[str] = None
    description: Optional[str] = None


class TeaResponse(TeaBase):
    id: int
    created_at: datetime
    class Config: from_attributes = True


class RegionBase(BaseModel):
    name: str
    province: Optional[str] = None
    altitude: Optional[str] = None
    climate: Optional[str] = None
    soil: Optional[str] = None
    history: Optional[str] = None
    famous_for: list[str] = []


class RegionResponse(RegionBase):
    id: int
    class Config: from_attributes = True


class PersonBase(BaseModel):
    name: str
    dynasty: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    contribution: Optional[str] = None
    quote: Optional[str] = None
    related_tea_ids: list[str] = []


class PersonResponse(PersonBase):
    id: int
    class Config: from_attributes = True


class PoemBase(BaseModel):
    title: str
    author: str
    dynasty: Optional[str] = None
    content: str
    related_tea_ids: list[str] = []
    description: Optional[str] = None


class PoemResponse(PoemBase):
    id: int
    class Config: from_attributes = True


class RecordCreate(BaseModel):
    tea_name: str
    tea_id: Optional[int] = None
    brew_temp: Optional[int] = None
    brew_time: Optional[int] = None
    infusions: Optional[int] = None
    water_type: Optional[str] = None
    ware_id: Optional[int] = None
    dimensions: dict = Field(default_factory=dict)
    overall_score: Optional[float] = None
    process_factor: Optional[float] = None
    aroma_type: Optional[str] = None
    notes: Optional[str] = None
    weather: Optional[str] = None
    mood: Optional[str] = None


class RecordResponse(RecordCreate):
    id: int
    user_id: Optional[int] = None
    created_at: datetime
    class Config: from_attributes = True


class UserCreate(BaseModel):
    username: str
    password: str
    display_name: Optional[str] = None

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    id: int
    username: str
    display_name: Optional[str] = None
    level: int
    xp: int
    preferred_type: Optional[str] = None
    class Config: from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
