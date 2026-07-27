"""
一盏茶 — 后端 API 服务
FastAPI + SQLAlchemy + PostgreSQL
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app.routers import teas, teawares, records, auth, culture

# 创建数据库表
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="一盏茶 API",
    description="东方数字茶空间后端服务",
    version="1.0.0",
)

# CORS 配置（允许前端开发服务器访问）
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",  # Vite 开发服务器
        "http://localhost:3000",
        "http://localhost:8080",
    ],
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
