"""数据库配置"""

import os

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# 数据库连接字符串（优先使用环境变量）
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://tea_user:tea_pass@localhost:5432/tea_ceremony",
)

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI 依赖注入：获取数据库会话"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
