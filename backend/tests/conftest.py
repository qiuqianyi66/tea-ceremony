"""pytest 共享夹具：SQLite 异步内存库 + 依赖覆盖 + TestClient。

说明：
- API 测试使用 SQLite 内存库（StaticPool 保证单连接共享），避免依赖外部 PostgreSQL。
- 表结构通过 Base.metadata.create_all 生成（models 层使用通用 sa.JSON，SQLite 可兼容），
  刻意绕开 Alembic 迁移脚本中的 PostgreSQL 专属类型（JSONB / postgresql_where），
  迁移脚本正确性由 test_migrations.py 在真实 PostgreSQL 上单独验证。
"""

import os

# 测试环境禁用 Sentry：避免其后台线程在进程退出时等待发送队列导致 pytest 挂起
os.environ["SENTRY_DSN"] = ""

# 必须在 import app 之前设置，否则 main.py 启动校验会失败。
os.environ.setdefault("SECRET_KEY", "test-secret-key-for-pytest")
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
import main as app_main

# SQLite 异步内存库：StaticPool 让所有连接共享同一个内存库。
test_engine = create_async_engine(
    "sqlite+aiosqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = async_sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


async def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        await db.close()


app_main.app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(scope="session", autouse=True)
async def _db_schema():
    """会话级：创建一次表结构，测试结束后清理并释放连接（否则 aiosqlite worker 线程残留，进程退出挂起）。"""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await test_engine.dispose()


@pytest.fixture()
async def db_session():
    """函数级：每个测试独立的数据库会话，并用例间清空数据。"""
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        await session.close()
        async with test_engine.connect() as conn:
            for table in reversed(Base.metadata.sorted_tables):
                await conn.execute(table.delete())
            await conn.commit()


@pytest.fixture()
def client():
    """FastAPI 测试客户端，绑定 SQLite 异步内存库。"""
    with TestClient(app_main.app) as c:
        yield c
