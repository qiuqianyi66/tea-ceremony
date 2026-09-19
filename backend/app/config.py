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
# 专项限流：登录/注册防爆破（OWASP API2），AI 是付费出口（全局 300/60s 太松）
RATE_LIMIT_LOGIN_MAX = int(os.environ.get("RATE_LIMIT_LOGIN_MAX", "10"))
RATE_LIMIT_LOGIN_WINDOW = int(os.environ.get("RATE_LIMIT_LOGIN_WINDOW", "300"))
RATE_LIMIT_AI_MAX = int(os.environ.get("RATE_LIMIT_AI_MAX", "10"))
RATE_LIMIT_AI_WINDOW = int(os.environ.get("RATE_LIMIT_AI_WINDOW", "60"))
REDIS_URL = os.environ.get("REDIS_URL", "")

# TrustedHost：允许的 Host 头列表（逗号分隔）。默认 "*" 保持现状；生产必须配置实际域名，防止 Host 头投毒
ALLOWED_HOSTS = [
    host.strip() for host in os.environ.get("ALLOWED_HOSTS", "*").split(",") if host.strip()
]

# Sentry 错误追踪（配置 SENTRY_DSN 时启用；请求体不上传，避免登录密码泄漏）
SENTRY_DSN = os.environ.get("SENTRY_DSN", "")
SENTRY_TRACES_SAMPLE_RATE = float(os.environ.get("SENTRY_TRACES_SAMPLE_RATE", "1.0"))

# AI 代理（DeepSeek 官方 API，OpenAI 兼容；浏览器不直连，统一经后端转发）
# - 在 https://platform.deepseek.com 申请 key 后填入 .env 的 AI_PROXY_KEY
# - 模型名：deepseek-flash（官方当前默认；旧名 deepseek-v4-flash 已退役，由 V4.1-Flash 服务）
# - 未配置 key 时后端返回 401/502，前端自动降级到规则引擎（离线兜底不受影响）
AI_PROXY_URL = os.environ.get("AI_PROXY_URL", "https://api.deepseek.com/chat/completions")
AI_PROXY_MODEL = os.environ.get("AI_PROXY_MODEL", "deepseek-flash")
AI_PROXY_KEY = os.environ.get("AI_PROXY_KEY", "")
AI_PROXY_TIMEOUT = int(os.environ.get("AI_PROXY_TIMEOUT", "30"))
# 5xx/网络错误重试的指数退避基数（秒）：第 n 次重试前等待 0.5 * 2**n；4xx 不重试
AI_RETRY_BACKOFF = float(os.environ.get("AI_RETRY_BACKOFF", "0.5"))
