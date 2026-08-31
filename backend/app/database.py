"""数据库配置"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import DATABASE_URL as CONFIG_DATABASE_URL

if not CONFIG_DATABASE_URL:
    raise RuntimeError("DATABASE_URL 环境变量未设置，无法初始化数据库连接")

DATABASE_URL = CONFIG_DATABASE_URL

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
