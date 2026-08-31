"""Alembic 迁移环境配置"""

from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context

# Alembic Config 对象
config = context.config

# 日志配置
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# 导入所有模型（让 Alembic 自动检测）
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
database_url = os.environ.get("DATABASE_URL")
if not database_url:
    raise RuntimeError("DATABASE_URL 环境变量未设置，无法运行 Alembic 迁移")
# Alembic 使用 ConfigParser，百分号需要转义；这样密码中的特殊字符也能正常工作。
config.set_main_option("sqlalchemy.url", database_url.replace("%", "%%"))
from app.database import Base
from app.models import (
    Tea, TeaRegion, TeaProcess, TeaPerson, TeaPoem,
    TeaWareV2, TeaEtiquette, TeaRelation, WaterSource,
    TeaJourney, TeaPersonRelation, UserV2, TastingRecordV2,
)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """离线模式：生成 SQL 脚本而不连接数据库"""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """在线模式：直接连接数据库执行迁移"""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
