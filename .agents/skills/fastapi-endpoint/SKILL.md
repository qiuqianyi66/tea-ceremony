---
name: fastapi-endpoint
description: 为一盏茶项目生成符合规范的 FastAPI 接口。当用户要求新增 API、修改后端路由、或添加后端功能时触发。
---

# FastAPI 接口生成规范

为一盏茶项目生成或修改后端 API 时，严格遵循以下流程。

## 1. 生成前检查

1. 确认资源名称和 RESTful 路径（复数名词，如 `/api/teas`、`/api/records`）
2. 检查 `backend/app/routers/` 中是否已有相关路由文件
3. 确认是否需要认证（需要登录则加 `Depends(get_current_user)`）
4. 检查 `backend/app/models/` 和 `backend/app/schemas/` 中是否已有相关模型

## 2. 标准结构

### 路由文件（`backend/app/routers/xxx.py`）

```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.xxx import Xxx
from app.schemas.xxx import XxxCreate, XxxResponse
from app.core.security import get_current_user

router = APIRouter(prefix="/api/xxx", tags=["xxx"])


@router.get("", response_model=list[XxxResponse])
async def list_xxx(
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user),  # 需要认证时加
):
    """获取 xxx 列表"""
    # 实现逻辑
    pass


@router.post("", response_model=XxxResponse, status_code=status.HTTP_201_CREATED)
async def create_xxx(
    data: XxxCreate,
    db: AsyncSession = Depends(get_db),
):
    """创建 xxx"""
    # 实现逻辑
    pass


@router.get("/{xxx_id}", response_model=XxxResponse)
async def get_xxx(
    xxx_id: int,
    db: AsyncSession = Depends(get_db),
):
    """获取单个 xxx"""
    # 实现逻辑
    pass
```

### Schema（`backend/app/schemas/xxx.py`）

```python
from pydantic import BaseModel, Field
from datetime import datetime


class XxxBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: str | None = None


class XxxCreate(XxxBase):
    pass


class XxxResponse(XxxBase):
    id: int
    created_at: datetime

    model_config = {"from_attributes": True}
```

### 模型（`backend/app/models/xxx.py`）

```python
from sqlalchemy import Integer, String, Text, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Xxx(Base):
    __tablename__ = "xxx"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
```

## 3. 硬性规则

- **必须**用 SQLAlchemy 2.0 异步风格（`AsyncSession`、`Mapped[]`）
- **必须**定义 Pydantic 请求和响应 schema，不直接返回 ORM 对象
- **必须**在 `main.py` 中注册新路由
- **必须**生成 Alembic 迁移脚本（如果改了模型）
- **禁止**在路由中写复杂业务逻辑，抽到 `app/services/`
- **禁止**硬编码数据库连接，用 `get_db` 依赖
- 错误用 `HTTPException(status_code=..., detail=...)`
- 认证用 `get_current_user` 依赖，不自己解析 JWT

## 4. 生成后验证

1. `cd backend && python -m py_compile main.py` 通过
2. 启动后端，访问 `/docs` 确认接口出现
3. 用 curl 或 Swagger 测试接口
4. 如有模型变更，生成并执行迁移：
   ```bash
   cd backend
   alembic revision --autogenerate -m "add xxx table"
   alembic upgrade head
   ```

## 5. 项目特有注意

- 品鉴记录接口要处理离线同步（`sync_status` 字段）
- 茶文化检索接口走 `app/services/` 中的 RAG 逻辑
- 所有写操作需要认证，读操作视情况公开
- 种子数据在 `backend/seeds/`，新表要考虑是否需要初始数据
