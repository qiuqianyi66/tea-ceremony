"""茶叶 / 产区 schema。"""

from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class TeaBase(BaseModel):
    name: str
    category: str
    origin: str | None = None
    region_id: int | None = None
    process_id: int | None = None
    season: str | None = None
    grade: str | None = None
    best_temp: int | None = None
    best_time: int | None = None
    flavor: list[str] = Field(default_factory=list)
    story: str | None = None
    description: str | None = None


class TeaResponse(TeaBase):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class RegionBase(BaseModel):
    name: str
    province: str | None = None
    altitude: str | None = None
    climate: str | None = None
    soil: str | None = None
    history: str | None = None
    famous_for: list[str] = Field(default_factory=list)


class RegionResponse(RegionBase):
    id: int
    model_config = ConfigDict(from_attributes=True)
