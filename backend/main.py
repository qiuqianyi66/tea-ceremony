"""
一盏茶 — 后端 API 服务
FastAPI + SQLAlchemy + PostgreSQL
"""

import logging

from asgi_correlation_id import CorrelationIdMiddleware, correlation_id
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator
from pythonjsonlogger.json import JsonFormatter
from sqlalchemy import text
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.config import SECRET_KEY, DATABASE_URL, CORS_ORIGINS, DEV_MODE, ALLOWED_HOSTS
from app.config import SENTRY_DSN, SENTRY_TRACES_SAMPLE_RATE
from app.errors import register_error_handlers
from app.middleware import AccessLogMiddleware, RateLimitMiddleware

# ============ 日志（P1-1：JSON 结构化 + request_id 贯穿链路） ============
class RequestIdJsonFormatter(JsonFormatter):
    """JSON 日志格式化：输出 asctime/levelname/name/message + request_id（无则 "-"）。

    直接以 python-json-logger 的 JsonFormatter 输出 JSON 行，可用 jq 解析；
    request_id 从 asgi-correlation-id 的 contextvar 读取，跨中间件/路由/异常处理一致。
    """

    def add_fields(self, log_record, record, message_dict):
        super().add_fields(log_record, record, message_dict)
        log_record["request_id"] = correlation_id.get() or "-"


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
)
# basicConfig 只在首次调用时生效；把 root 的 handler 统一换成 JSON formatter
for handler in logging.root.handlers:
    handler.setFormatter(
        RequestIdJsonFormatter("%(asctime)s %(levelname)s %(name)s %(message)s")
    )
logger = logging.getLogger("tea.main")

# ============ 环境变量校验 ============
if not SECRET_KEY:
    raise RuntimeError(
        "SECRET_KEY 环境变量未设置！\n"
        "请复制 .env.example 为 .env 并填入安全的随机字符串。\n"
        "生成方法：python3 -c \"import secrets; print(secrets.token_hex(32))\""
    )

if len(SECRET_KEY) < 32:
    raise RuntimeError(
        f"SECRET_KEY 强度不足（长度 {len(SECRET_KEY)} < 32）！\n"
        "过短密钥可被爆破伪造 JWT，请生成强随机密钥：\n"
        "python3 -c \"import secrets; print(secrets.token_hex(32))\""
    )

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL 环境变量未设置！请在 .env 中配置 PostgreSQL 连接串。")

# 配置校验通过后再创建数据库引擎和加载路由。
from app.database import engine
from app.routers import teas, teawares, records, auth, culture, ai

# ============ Sentry 错误追踪 ============
# 配置 SENTRY_DSN 后启用：未捕获异常自动上报（聚合/上下文/告警）。
# max_request_body_size="never"：登录接口请求体含密码，禁止上传；send_default_pii=False 不收集用户隐私。
if SENTRY_DSN:
    import sentry_sdk

    sentry_sdk.init(
        dsn=SENTRY_DSN,
        release="tea@1.0.0",
        environment="development" if DEV_MODE else "production",
        traces_sample_rate=SENTRY_TRACES_SAMPLE_RATE,
        send_default_pii=False,
        max_request_body_size="never",
    )

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
# TrustedHost 放最外层：Host 头不在 ALLOWED_HOSTS 直接 400，防 Host 头缓存投毒/重置链接投毒
app.add_middleware(TrustedHostMiddleware, allowed_hosts=ALLOWED_HOSTS)
# P1-1：request_id 中间件放最内层（最先执行），生成/透传 X-Request-ID 并写入日志 contextvar
app.add_middleware(CorrelationIdMiddleware)

# 统一错误格式
register_error_handlers(app)

# 注册路由
app.include_router(auth.router, prefix="/api/auth", tags=["认证"])
app.include_router(teas.router, prefix="/api/teas", tags=["茶叶"])
app.include_router(teawares.router, prefix="/api/teawares", tags=["茶器"])
app.include_router(records.router, prefix="/api/records", tags=["品鉴记录"])
app.include_router(culture.router, prefix="/api/culture", tags=["茶文化"])
app.include_router(ai.router, prefix="/api/ai", tags=["茶灵 AI"])

# P1-2：Prometheus /metrics（SRE 四信号：延迟/流量/错误/饱和），默认指标暴露文本格式
Instrumentator().instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)


@app.get("/")
def root():
    return {"message": "一盏茶 API", "version": "1.0.0"}


@app.get("/live")
async def live():
    """存活探针（P1-12）：进程活着即 200，不查依赖——DB 抖动不应触发容器重启。"""
    return {"status": "ok"}


@app.get("/ready")
async def ready():
    """就绪探针（P1-12）：DB 不可用返回 503，编排系统据此摘除实例。"""
    try:
        async with engine.connect() as connection:
            await connection.execute(text("SELECT 1"))
    except Exception as error:
        # 健康检查失败时返回 503，便于 Docker/Kubernetes 正确摘除实例。
        raise HTTPException(status_code=503, detail="数据库连接不可用") from error
    return {"status": "ok", "database": "ok", "dev_mode": DEV_MODE}


@app.get("/health")
@app.get("/api/health")
async def health():
    """兼容旧探针：语义与 /ready 一致（查 DB）。"""
    return await ready()
