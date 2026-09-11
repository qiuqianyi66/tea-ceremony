"""文化域：茶人 / 茶诗 schema。"""

from pydantic import BaseModel, Field, ConfigDict


class PersonBase(BaseModel):
    name: str
    dynasty: str | None = None
    title: str | None = None
    description: str | None = None
    contribution: str | None = None
    quote: str | None = None
    related_tea_ids: list[str] = Field(default_factory=list)


class PersonResponse(PersonBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


class PoemBase(BaseModel):
    title: str
    author: str
    dynasty: str | None = None
    content: str
    related_tea_ids: list[str] = Field(default_factory=list)
    description: str | None = None


class PoemResponse(PoemBase):
    id: int
    model_config = ConfigDict(from_attributes=True)
