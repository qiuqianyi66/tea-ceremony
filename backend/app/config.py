"""应用配置：统一读取环境变量，避免路由反向导入 main.py。"""

import os
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.environ.get("SECRET_KEY", "")
DATABASE_URL = os.environ.get("DATABASE_URL", "")
DEV_MODE = os.environ.get("DEV_MODE", "false").lower() == "true"

# CORS：生产环境默认只允许同源（Nginx 同源代理 /api），
# 开发环境默认放行 Vite / 本地端口；可通过 CORS_ORIGINS 显式覆盖。
_DEFAULT_CORS = "http://localhost:5173,http://localhost:3000" if DEV_MODE else ""
CORS_ORIGINS = [
    origin.strip()
    for origin in os.environ.get("CORS_ORIGINS", _DEFAULT_CORS).split(",")
    if origin.strip()
]

# 限流（滑动窗口；配置 REDIS_URL 时多实例共享计数，未配置则进程内存 + Redis 不可用自动降级）
RATE_LIMIT_MAX = int(os.environ.get("RATE_LIMIT_MAX", "300"))
RATE_LIMIT_WINDOW = int(os.environ.get("RATE_LIMIT_WINDOW", "60"))
REDIS_URL = os.environ.get("REDIS_URL", "")

# Sentry 错误追踪（配置 SENTRY_DSN 时启用；请求体不上传，避免登录密码泄漏）
SENTRY_DSN = os.environ.get("SENTRY_DSN", "")
SENTRY_TRACES_SAMPLE_RATE = float(os.environ.get("SENTRY_TRACES_SAMPLE_RATE", "1.0"))

# AI 代理（OpenRouter，OpenAI 兼容）
# - 注册 key（免费，每天约 50 次免费模型调用）后填入 .env 的 AI_PROXY_KEY
# - 默认模型：免费池中实测中文稳定的模型；免费档会动态变化，可在 .env 改 AI_PROXY_MODEL
# - 未配置 key 时后端返回 401/502，前端自动降级到规则引擎（离线兜底不受影响）
AI_PROXY_URL = os.environ.get("AI_PROXY_URL", "https://openrouter.ai/api/v1/chat/completions")
AI_PROXY_MODEL = os.environ.get("AI_PROXY_MODEL", "inclusionai/ling-3.0-flash-sante:free")
AI_PROXY_KEY = os.environ.get("AI_PROXY_KEY", "")
AI_PROXY_TIMEOUT = int(os.environ.get("AI_PROXY_TIMEOUT", "30"))
