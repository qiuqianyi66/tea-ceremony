"""统一错误格式测试：HTTP 错误 / 校验错误 / 未捕获异常。"""

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.errors import register_error_handlers


def test_http_error_uses_unified_format(client: TestClient):
    res = client.get("/api/culture/regions/999999")
    assert res.status_code == 404
    body = res.json()
    assert body["status"] == 404
    assert body["code"] == "NOT_FOUND"
    assert "detail" in body


def test_validation_error_uses_unified_format(client: TestClient):
    # 缺少 username / password
    res = client.post("/api/auth/register", json={"display_name": "x"})
    assert res.status_code == 422
    body = res.json()
    assert body["code"] == "VALIDATION_ERROR"
    assert body["status"] == 422
    assert "参数校验失败" in body["detail"]


def test_ai_validation_uses_unified_format(client: TestClient):
    # role 枚举非法
    res = client.post(
        "/api/ai/chat",
        json={"messages": [{"role": "admin", "content": "hi"}]},
    )
    assert res.status_code == 422
    assert res.json()["code"] == "VALIDATION_ERROR"


def test_unhandled_exception_returns_500():
    """未捕获异常统一为 500 且记录日志（不泄漏堆栈）。"""
    app = FastAPI()
    register_error_handlers(app)

    @app.get("/boom")
    def boom():
        raise ValueError("secret detail")

    # raise_server_exceptions=False：Starlette 对 Exception handler 在 True 时总是重抛，
    # 无法观测统一 500 响应。
    client = TestClient(app, raise_server_exceptions=False)
    res = client.get("/boom")
    assert res.status_code == 500
    body = res.json()
    assert body["code"] == "INTERNAL_ERROR"
    assert body["status"] == 500
    assert "secret detail" not in body["detail"]
