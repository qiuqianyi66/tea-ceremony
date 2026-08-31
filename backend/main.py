"""
一盏茶 — 后端 API 服务
FastAPI + SQLAlchemy + PostgreSQL
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import SECRET_KEY, DATABASE_URL, CORS_ORIGINS, DEV_MODE

# ============ 环境变量校验 ============
if not SECRET_KEY:
    raise RuntimeError(
        "SECRET_KEY 环境变量未设置！\n"
        "请复制 .env.example 为 .env 并填入安全的随机字符串。\n"
        "生成方法：python3 -c \"import secrets; print(secrets.token_hex(32))\""
    )

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL 环境变量未设置！请在 .env 中配置 PostgreSQL 连接串。")

# 配置校验通过后再创建数据库引擎和加载路由。
from app.database import engine
from app.routers import teas, teawares, records, auth, culture

# CORS 来源
# ============ FastAPI 应用 ============
app = FastAPI(
    title="一盏茶 API",
    description="东方数字茶空间后端服务",
    version="1.0.0",
)

# CORS 配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(auth.router, prefix="/api/auth", tags=["认证"])
app.include_router(teas.router, prefix="/api/teas", tags=["茶叶"])
app.include_router(teawares.router, prefix="/api/teawares", tags=["茶器"])
app.include_router(records.router, prefix="/api/records", tags=["品鉴记录"])
app.include_router(culture.router, prefix="/api/culture", tags=["茶文化"])


@app.get("/")
def root():
    return {"message": "一盏茶 API", "version": "1.0.0"}


@app.get("/health")
def health():
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception as error:
        # 健康检查失败时返回 503，便于 Docker/Kubernetes 正确摘除实例。
        raise HTTPException(status_code=503, detail="数据库连接不可用") from error
    return {"status": "ok", "database": "ok", "dev_mode": DEV_MODE}
