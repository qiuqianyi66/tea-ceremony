"""连接池死连接恢复测试（P0-2 验收）：Postgres 断连后 pool_pre_ping 应重建连接而非报错。

模拟方式：从 PG 侧 pg_terminate_backend 终止测试引擎持有的连接（等价于服务重启后旧连接失效），
再复用连接池连接执行查询。
- 对照组（pool_pre_ping=False）必须失败，证明测试有区分度；
- 需要真实 PostgreSQL（TEST_DATABASE_URL）；CI 的 migration-test job 提供，本地无此变量时自动跳过。
"""

import os

import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL", "")
TEST_APP_NAME = "tea_pool_test"

pytestmark = pytest.mark.skipif(
    not TEST_DATABASE_URL,
    reason="需要 TEST_DATABASE_URL（真实 PostgreSQL）",
)


def _async_url(url: str) -> str:
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


def _make_engine(pool_pre_ping: bool):
    return create_async_engine(
        _async_url(TEST_DATABASE_URL),
        pool_size=1,
        max_overflow=0,
        pool_pre_ping=pool_pre_ping,
        connect_args={"server_settings": {"application_name": TEST_APP_NAME}},
    )


async def _kill_test_connections() -> None:
    """只终止 application_name=tea_pool_test 的后端连接（不影响其他连接）。"""
    kill_engine = create_async_engine(_async_url(TEST_DATABASE_URL))
    try:
        async with kill_engine.connect() as conn:
            await conn.execute(
                text(
                    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
                    "WHERE datname = current_database() "
                    "AND application_name = :app AND pid <> pg_backend_pid()"
                ),
                {"app": TEST_APP_NAME},
            )
            await conn.commit()
    finally:
        await kill_engine.dispose()


async def test_pool_pre_ping_recovers_after_terminated_connection():
    """杀掉连接池持有的连接后，下一次查询经 pre_ping 重建连接并成功（不报死连接）。"""
    engine = _make_engine(pool_pre_ping=True)
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        # 模拟 PG 重启：终止连接池持有的连接
        await _kill_test_connections()
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT 1"))
            assert result.scalar() == 1
    finally:
        await engine.dispose()


async def test_no_pre_ping_fails_after_terminated_connection():
    """对照组：无 pool_pre_ping 时，连接被服务端关闭后复用会报错（证明测试能区分）。"""
    engine = _make_engine(pool_pre_ping=False)
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        await _kill_test_connections()
        # 对照组只验证"连接失效后复用必报错"；具体异常类型随驱动/时序变化，刻意宽断言（B017 不适用）。
        with pytest.raises(Exception):  # noqa: B017
            async with engine.connect() as conn:
                await conn.execute(text("SELECT 1"))
    finally:
        await engine.dispose()
