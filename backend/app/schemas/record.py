"""品鉴记录 schema。"""

from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class RecordCreate(BaseModel):
    client_id: str | None = None
    tea_name: str
    tea_id: int | None = None
    brew_temp: int | None = None
    brew_time: int | None = None
    infusions: int | None = None
    water_type: str | None = None
    ware_id: int | None = None
    dimensions: dict = Field(default_factory=dict)
    overall_score: float | None = None
    process_factor: float | None = None
    aroma_type: str | None = None
    notes: str | None = None
    weather: str | None = None
    mood: str | None = None


class RecordResponse(RecordCreate):
    id: int
    user_id: int | None = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
