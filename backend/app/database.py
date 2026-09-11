"""数据库配置 — SQLAlchemy 2.0 异步风格。

DATABASE_URL 兼容两种写法：
- postgresql://...          自动转成 postgresql+asyncpg://...
- sqlite:///:memory:        自动转成 sqlite+aiosqlite:///
"""

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base
from app.config import DATABASE_URL as CONFIG_DATABASE_URL

if not CONFIG_DATABASE_URL:
    raise RuntimeError("DATABASE_URL 环境变量未设置，无法初始化数据库连接")


def _to_async_url(url: str) -> str:
    """把同步驱动 scheme 转成异步驱动 scheme。"""
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    if url.startswith("postgresql+asyncpg://"):
        return url
    if url.startswith("sqlite://"):
        return url.replace("sqlite://", "sqlite+aiosqlite://", 1)
    return url


DATABASE_URL = CONFIG_DATABASE_URL
ASYNC_DATABASE_URL = _to_async_url(DATABASE_URL)

engine = create_async_engine(ASYNC_DATABASE_URL)
SessionLocal = async_sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


async def get_db() -> AsyncSession:
    """FastAPI 依赖注入：获取异步数据库会话"""
    db = SessionLocal()
    try:
        yield db
    finally:
        await db.close()
