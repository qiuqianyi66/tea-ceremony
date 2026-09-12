"""中间件：请求访问日志 + 基于 IP/路径的滑动窗口限流。

说明：
- 限流存储抽象为 RateStore：RedisRateStore（多实例共享）为主，MemoryRateStore（进程内）兜底。
- 配置 REDIS_URL 时启用分布式限流；Redis 不可用时自动降级进程内存限流 60s 并告警日志。
- 窗口时间统一用墙钟 time.time()：Redis 多实例共享计数必须用墙钟（monotonic 是每进程独立时钟，跨进程不可比）。
- 请求日志记录 method / path / status / 耗时，未捕获异常由统一处理器兜底记录。
"""

import logging
import time
import uuid
from collections import defaultdict, deque
from typing import Protocol

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from redis.exceptions import RedisError
import redis.asyncio as aioredis

from app.config import RATE_LIMIT_MAX, RATE_LIMIT_WINDOW, REDIS_URL

access_logger = logging.getLogger("tea.access")
logger = logging.getLogger("tea.middleware")

# Redis 不可用时的降级时长（秒）：降级期内不再尝试 Redis，避免每次请求重复失败开销
DEGRADE_SECONDS = 60


class RateStore(Protocol):
    """限流计数存储接口。返回 True 表示本次请求已超限。"""

    async def check_and_record(
        self, key: str, now: float, window: float, max_requests: int
    ) -> bool | None: ...


class MemoryRateStore:
    """进程内存滑动窗口（单实例 / Redis 不可用时的兜底）。"""

    def __init__(self) -> None:
        self._store: dict[str, deque[float]] = defaultdict(deque)

    async def check_and_record(self, key: str, now: float, window: float, max_requests: int) -> bool:
        queue = self._store[key]
        while queue and now - queue[0] > window:
            queue.popleft()
        if len(queue) >= max_requests:
            return True
        queue.append(now)
        return False

    def clear(self) -> None:
        self._store.clear()


class RedisRateStore:
    """Redis 滑动窗口（ZSET，score=时间戳）。多实例共享同一计数。"""

    def __init__(self, url: str) -> None:
        self._client = aioredis.from_url(
            url,
            socket_connect_timeout=0.3,
            socket_timeout=0.3,
        )

    async def check_and_record(self, key: str, now: float, window: float, max_requests: int) -> bool | None:
        """超限返回 True；存储不可用返回 None（由调用方决定降级）。"""
        try:
            pipe = self._client.pipeline(transaction=False)
            pipe.zremrangebyscore(key, 0, now - window)
            pipe.zcard(key)
            # member 加随机后缀：同秒多请求时间戳相同，避免互相覆盖导致少计数
            pipe.zadd(key, {f"{now:.6f}:{uuid.uuid4().hex[:6]}": now})
            pipe.expire(key, int(window) + 1)
            _, count, _, _ = await pipe.execute()
            return count >= max_requests
        except RedisError:
            return None


# 模块级内存 store：middleware 默认以此为兜底；reset_rate_store 清它（测试用）
_default_memory_store = MemoryRateStore()


def reset_rate_store() -> None:
    """清空限流计数（测试用）。"""
    _default_memory_store.clear()


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

    def __init__(
        self,
        app,
        max_requests: int = RATE_LIMIT_MAX,
        window: int = RATE_LIMIT_WINDOW,
        memory_store: MemoryRateStore | None = None,
    ):
        super().__init__(app)
        self.max_requests = max_requests
        self.window = window
        self._memory_store = memory_store or _default_memory_store
        self._redis_store = RedisRateStore(REDIS_URL) if REDIS_URL else None
        self._degraded_until = 0.0

    async def dispatch(self, request: Request, call_next):
        if request.url.path == "/health":
            return await call_next(request)

        ip = request.client.host if request.client else "unknown"
        key = f"rate:{ip}:{request.url.path}"
        now = time.time()

        if not self._redis_store or now < self._degraded_until:
            over = await self._memory_store.check_and_record(key, now, self.window, self.max_requests)
        else:
            result = await self._redis_store.check_and_record(key, now, self.window, self.max_requests)
            if result is None:
                logger.warning("Redis 限流不可用，降级进程内存限流 %ds: %s", DEGRADE_SECONDS, key)
                self._degraded_until = now + DEGRADE_SECONDS
                over = await self._memory_store.check_and_record(key, now, self.window, self.max_requests)
            else:
                over = result

        if over:
            return JSONResponse(
                status_code=429,
                content={
                    "detail": "请求过于频繁，请稍后再试",
                    "code": "RATE_LIMITED",
                    "status": 429,
                },
            )
        return await call_next(request)
