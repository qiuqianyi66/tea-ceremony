"""Pydantic schema 聚合导出 — 按域分文件。

拆分历史：原 schemas.py 单文件，按域拆为 tea/record/user（culture/ware 两域随
2026-10-22 D9 旧端点退役一并移除，见 docs/architecture/backend-migration-status.md §3）。
对外保持 `from app.schemas import UserCreate, ...` 不变。
"""

from app.schemas.record import RecordCreate, RecordResponse
from app.schemas.tea import RegionBase, RegionResponse, TeaBase, TeaResponse
from app.schemas.user import TokenResponse, UserCreate, UserLogin, UserResponse

__all__ = [
    "TeaBase",
    "TeaResponse",
    "RegionBase",
    "RegionResponse",
    "RecordCreate",
    "RecordResponse",
    "UserCreate",
    "UserLogin",
    "UserResponse",
    "TokenResponse",
]
