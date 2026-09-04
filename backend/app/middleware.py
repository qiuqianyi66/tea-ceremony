"""中间件：请求访问日志 + 基于 IP/路径的滑动窗口限流。

说明：
- 限流使用进程内内存存储，适合单实例；多实例 / 生产规模建议换 Redis 等外部存储。
- 请求日志记录 method / path / status / 耗时，未捕获异常由统一处理器兜底记录。
"""

import logging
import time
from collections import defaultdict, deque

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import RATE_LIMIT_MAX, RATE_LIMIT_WINDOW

access_logger = logging.getLogger("tea.access")

# 限流存储：key = f"{client_ip}:{path}" → 最近请求时间戳队列
_rate_store: dict[str, deque[float]] = defaultdict(deque)


def reset_rate_store() -> None:
    """清空限流计数（测试用）。"""
    _rate_store.clear()


class AccessLogMiddleware(BaseHTTPMiddleware):
    """请求日志：method / path / status / 耗时。"""

    async def dispatch(self, request: Request, call_next):
        start = time.monotonic()
        try:
            response = await call_next(request)
        except Exception:
            access_logger.exception("请求处理异常: %s %s", request.method, request.url.path)
            raise
        duration_ms = (time.monotonic() - start) * 1000
        access_logger.info(
            "%s %s -> %s (%.0fms)",
            request.method, request.url.path, response.status_code, duration_ms,
        )
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """基于 IP + 路径的滑动窗口限流；/health 不限流。"""

    def __init__(self, app, max_requests: int = RATE_LIMIT_MAX, window: int = RATE_LIMIT_WINDOW):
        super().__init__(app)
        self.max_requests = max_requests
        self.window = window

    async def dispatch(self, request: Request, call_next):
        if request.url.path == "/health":
            return await call_next(request)

        ip = request.client.host if request.client else "unknown"
        key = f"{ip}:{request.url.path}"
        now = time.monotonic()
        queue = _rate_store[key]

        # 清理窗口外的时间戳
        while queue and now - queue[0] > self.window:
            queue.popleft()

        if len(queue) >= self.max_requests:
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "请求过于频繁，请稍后再试",
                    "code": "RATE_LIMITED",
                    "status": 429,
                },
            )
        queue.append(now)
        return await call_next(request)
