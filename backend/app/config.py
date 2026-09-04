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

# 限流（内存滑动窗口）
RATE_LIMIT_MAX = int(os.environ.get("RATE_LIMIT_MAX", "300"))
RATE_LIMIT_WINDOW = int(os.environ.get("RATE_LIMIT_WINDOW", "60"))

# AI 代理（Pollinations）
AI_PROXY_URL = os.environ.get("AI_PROXY_URL", "https://text.pollinations.ai/openai")
AI_PROXY_MODEL = os.environ.get("AI_PROXY_MODEL", "deepseek")
AI_PROXY_TIMEOUT = int(os.environ.get("AI_PROXY_TIMEOUT", "8"))
