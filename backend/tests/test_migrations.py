"""数据库迁移测试：Alembic upgrade / downgrade 往返验证。

说明：
- 必须通过环境变量 TEST_DATABASE_URL 显式指定一个【专用测试库】，绝不使用 DATABASE_URL。
- 未设置 TEST_DATABASE_URL 或无法连接时自动 skip（CI 中强制运行）。
- 测试会对该库执行 downgrade base，请勿指向任何包含重要数据的数据库。
"""

import os
from pathlib import Path

import pytest
from sqlalchemy import create_engine, inspect, text
from alembic import command
from alembic.config import Config

BACKEND_DIR = Path(__file__).resolve().parents[1]
ALEMBIC_INI = BACKEND_DIR / "alembic.ini"

TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL", "")

EXPECTED_TABLES = {
    "tea_regions",
    "tea_processes",
    "teas",
    "tea_people",
    "tea_poems",
    "teawares_v2",
    "tea_etiquettes",
    "tea_relations",
    "users_v2",
    "tasting_records_v2",
    "water_sources",
    "tea_journeys",
    "tea_person_relations",
    "culture_documents",
}


def _alembic_config(url: str) -> Config:
    cfg = Config(str(ALEMBIC_INI))
    cfg.set_main_option("sqlalchemy.url", url)
    return cfg


@pytest.fixture(scope="module")
def migration_db():
    """连接测试库；不可用时跳过。"""
    if not TEST_DATABASE_URL:
        pytest.skip("未设置 TEST_DATABASE_URL，跳过迁移测试（CI 中会强制运行）")

    engine = create_engine(TEST_DATABASE_URL)
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as error:  # noqa: BLE001 - 连接失败即跳过
        pytest.skip(f"无法连接测试数据库: {error}")
    yield engine
    engine.dispose()


def test_migrations_upgrade_and_downgrade_roundtrip(migration_db):
    """upgrade head → 关键表存在；downgrade base → 业务表删除；可再次 upgrade。"""
    cfg = _alembic_config(TEST_DATABASE_URL)

    # 1. 升级到最新
    command.upgrade(cfg, "head")
    inspector = inspect(migration_db)
    tables_after_upgrade = set(inspector.get_table_names())
    assert EXPECTED_TABLES.issubset(tables_after_upgrade), (
        f"缺失表: {EXPECTED_TABLES - tables_after_upgrade}"
    )

    # 2. 回滚到初始
    command.downgrade(cfg, "base")
    tables_after_downgrade = set(inspect(migration_db).get_table_names())
    assert EXPECTED_TABLES.isdisjoint(tables_after_downgrade), (
        f"downgrade 后仍存在业务表: {EXPECTED_TABLES & tables_after_downgrade}"
    )

    # 3. 再次升级（验证迁移脚本可重复执行、无残留状态）
    command.upgrade(cfg, "head")
    tables_again = set(inspect(migration_db).get_table_names())
    assert EXPECTED_TABLES.issubset(tables_again)
