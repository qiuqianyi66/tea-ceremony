"""
一盏茶 — 后端 API 服务
FastAPI + SQLAlchemy + PostgreSQL
"""

import logging

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.config import SECRET_KEY, DATABASE_URL, CORS_ORIGINS, DEV_MODE
from app.errors import register_error_handlers
from app.middleware import AccessLogMiddleware, RateLimitMiddleware

# ============ 日志 ============
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
logger = logging.getLogger("tea.main")

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
from app.routers import teas, teawares, records, auth, culture, ai

# CORS 来源
# ============ FastAPI 应用 ============
app = FastAPI(
    title="一盏茶 API",
    description="东方数字茶空间后端服务",
    version="1.0.0",
)

# CORS 配置（生产默认仅同源，Nginx 负责 /api 代理；开发默认放行 Vite）
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 请求日志（外层）→ 限流（内层），最后 add 的最先执行
app.add_middleware(AccessLogMiddleware)
app.add_middleware(RateLimitMiddleware)

# 统一错误格式
register_error_handlers(app)

# 注册路由
app.include_router(auth.router, prefix="/api/auth", tags=["认证"])
app.include_router(teas.router, prefix="/api/teas", tags=["茶叶"])
app.include_router(teawares.router, prefix="/api/teawares", tags=["茶器"])
app.include_router(records.router, prefix="/api/records", tags=["品鉴记录"])
app.include_router(culture.router, prefix="/api/culture", tags=["茶文化"])
app.include_router(ai.router, prefix="/api/ai", tags=["茶灵 AI"])


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
