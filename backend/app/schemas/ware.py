"""茶器 schema。"""

from pydantic import BaseModel, ConfigDict, Field


class TeaWareResponse(BaseModel):
    id: int
    name: str
    ware_type: str | None = None
    material: str | None = None
    capacity: int | None = None
    origin: str | None = None
    dynasty: str | None = None
    craft: str | None = None
    description: str | None = None
    culture_story: str | None = None
    bonus: dict = Field(default_factory=dict)
    recommended: list[str] = Field(default_factory=list)
    rarity: str = "common"

    model_config = ConfigDict(from_attributes=True)
