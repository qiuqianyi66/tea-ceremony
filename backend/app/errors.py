"""统一 API 错误格式与异常处理器。

错误响应统一为：
    { "detail": "人类可读信息", "code": "机器可读代码", "status": HTTP状态码 }
"""

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("tea.errors")

STATUS_CODES: dict[int, str] = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    409: "CONFLICT",
    422: "VALIDATION_ERROR",
    429: "RATE_LIMITED",
    502: "BAD_GATEWAY",
    503: "SERVICE_UNAVAILABLE",
}


def error_payload(status_code: int, detail: Any, code: str | None = None) -> dict:
    return {
        "detail": str(detail),
        "code": code or STATUS_CODES.get(status_code, f"HTTP_{status_code}"),
        "status": status_code,
    }


def register_error_handlers(app: FastAPI) -> None:
    """注册统一异常处理器（HTTP / 校验 / 未捕获）。"""

    @app.exception_handler(StarletteHTTPException)
    async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        detail: Any = exc.detail
        if isinstance(detail, dict):
            detail = detail.get("message") or str(detail)
        return JSONResponse(
            status_code=exc.status_code,
            content=error_payload(exc.status_code, detail),
        )

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        errors = exc.errors()
        first = errors[0] if errors else {}
        loc = ".".join(str(part) for part in first.get("loc", []) if part != "body")
        msg = str(first.get("msg", "请求参数不合法"))
        detail = f"参数校验失败: {loc} {msg}" if loc else f"参数校验失败: {msg}"
        return JSONResponse(
            status_code=422,
            content=error_payload(422, detail, "VALIDATION_ERROR"),
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        logger.exception("未捕获异常: %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=500,
            content=error_payload(500, "服务器内部错误，请稍后重试", "INTERNAL_ERROR"),
        )
