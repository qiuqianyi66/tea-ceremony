"""茶园 schema。"""

from datetime import datetime
from pydantic import BaseModel, ConfigDict


class GardenPlantCreate(BaseModel):
    client_id: str
    region_id: str
    tea_id: str
    planted_at: datetime
    last_watered_at: datetime | None = None
    water_level: int = 100
    pruned: bool = False
    status: str = "growing"
    harvest_count: int = 0
    harvested_at: datetime | None = None


class GardenPlantResponse(GardenPlantCreate):
    id: int
    user_id: int | None = None
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
