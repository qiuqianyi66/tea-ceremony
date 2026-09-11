"""ORM 模型聚合导出 — 按域分文件，此处统一再导出。

拆分历史：原 models.py 单文件 270 行，按域拆为 tea/culture/ware/user/record/garden/knowledge。
对外保持 `from app.models import Tea, User, ...` 不变，router/alembic/seeds 无需改动。
"""

from app.models.tea import Tea, TeaRegion, TeaProcess
from app.models.culture import (
    TeaPerson,
    TeaPoem,
    TeaEtiquette,
    TeaRelation,
    TeaPersonRelation,
)
from app.models.ware import TeaWareV2
from app.models.user import UserV2, TeaJourney
from app.models.record import TastingRecordV2
from app.models.garden import GardenPlant, WaterSource
from app.models.knowledge import CultureDocument

# 向后兼容别名（老代码用 User/TastingRecord/TeaWare，新代码优先用 V2 真名）
User = UserV2
TastingRecord = TastingRecordV2
TeaWare = TeaWareV2

__all__ = [
    "Tea",
    "TeaRegion",
    "TeaProcess",
    "TeaPerson",
    "TeaPoem",
    "TeaEtiquette",
    "TeaRelation",
    "TeaPersonRelation",
    "TeaWareV2",
    "UserV2",
    "TeaJourney",
    "TastingRecordV2",
    "GardenPlant",
    "WaterSource",
    "CultureDocument",
    # 别名
    "User",
    "TastingRecord",
    "TeaWare",
]
