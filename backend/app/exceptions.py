"""业务异常：service 层抛出，router 不直接 raise HTTPException。

统一由 errors.register_error_handlers 捕获，转成 {detail, code, status}。
"""


class BusinessError(Exception):
    """业务异常基类：携带 HTTP 状态码与机器可读 code。"""

    status_code: int = 400
    code: str = "BUSINESS_ERROR"

    def __init__(self, detail: str) -> None:
        self.detail = detail
        super().__init__(detail)


class BadRequestError(BusinessError):
    status_code = 400
    code = "BAD_REQUEST"


class UnauthorizedError(BusinessError):
    status_code = 401
    code = "UNAUTHORIZED"


class NotFoundError(BusinessError):
    status_code = 404
    code = "NOT_FOUND"


class ConflictError(BusinessError):
    status_code = 409
    code = "CONFLICT"
