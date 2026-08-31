"""应用配置：统一读取环境变量，避免路由反向导入 main.py。"""

import os
from dotenv import load_dotenv

load_dotenv()

SECRET_KEY = os.environ.get("SECRET_KEY", "")
DATABASE_URL = os.environ.get("DATABASE_URL", "")
CORS_ORIGINS = os.environ.get(
    "CORS_ORIGINS", "http://localhost:5173,http://localhost:3000"
).split(",")
DEV_MODE = os.environ.get("DEV_MODE", "false").lower() == "true"

