"""Pydantic schema 聚合导出 — 按域分文件。

拆分历史：原 schemas.py 单文件，按域拆为 tea/culture/record/user/garden。
对外保持 `from app.schemas import UserCreate, ...` 不变。
"""

from app.schemas.tea import TeaBase, TeaResponse, RegionBase, RegionResponse
from app.schemas.culture import PersonBase, PersonResponse, PoemBase, PoemResponse
from app.schemas.record import RecordCreate, RecordResponse
from app.schemas.user import UserCreate, UserLogin, UserResponse, TokenResponse
from app.schemas.garden import GardenPlantCreate, GardenPlantResponse

__all__ = [
    "TeaBase",
    "TeaResponse",
    "RegionBase",
    "RegionResponse",
    "PersonBase",
    "PersonResponse",
    "PoemBase",
    "PoemResponse",
    "RecordCreate",
    "RecordResponse",
    "UserCreate",
    "UserLogin",
    "UserResponse",
    "TokenResponse",
    "GardenPlantCreate",
    "GardenPlantResponse",
]
