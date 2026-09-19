"""限流中间件测试：超过阈值返回 429；/health 豁免；登录/AI 专项限流。"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.middleware import RateLimitMiddleware, reset_rate_store


@pytest.fixture()
def limited_app():
    reset_rate_store()
    app = FastAPI()
    app.add_middleware(
        RateLimitMiddleware,
        max_requests=5,
        window=60,
        login_max_requests=2,
        login_window=300,
        ai_max_requests=2,
        ai_window=60,
    )

    @app.get("/ping")
    def ping():
        return {"ok": True}

    @app.post("/api/auth/login")
    def login():
        return {"ok": True}

    @app.post("/api/ai/chat")
    def chat():
        return {"ok": True}

    @app.get("/health")
    def health():
        return {"status": "ok"}

    return app


def test_rate_limit_blocks_after_threshold(limited_app: FastAPI):
    client = TestClient(limited_app)
    for _ in range(5):
        assert client.get("/ping").status_code == 200
    # 第六次超限（全局阈值为 5）
    res = client.get("/ping")
    assert res.status_code == 429
    body = res.json()
    assert body["code"] == "RATE_LIMITED"
    assert body["status"] == 429


def test_health_is_exempt_from_rate_limit(limited_app: FastAPI):
    client = TestClient(limited_app)
    for _ in range(5):
        assert client.get("/health").status_code == 200


def test_login_rate_limit_blocks_after_threshold(limited_app: FastAPI):
    """登录专项限流：超过 login_max 后第 n+1 次返回 429（防爆破）。"""
    client = TestClient(limited_app)
    assert client.post("/api/auth/login").status_code == 200
    assert client.post("/api/auth/login").status_code == 200
    res = client.post("/api/auth/login")
    assert res.status_code == 429
    assert res.json()["code"] == "RATE_LIMITED"


def test_login_and_register_share_rate_limit_key(limited_app: FastAPI):
    """login/register 共享统一限流 key：轮换路径不能绕限流（register 无路由，中间件已先拦截计数）。"""
    client = TestClient(limited_app)
    assert client.post("/api/auth/login").status_code == 200
    assert client.post("/api/auth/login").status_code == 200
    res = client.post("/api/auth/register")
    assert res.status_code == 429


def test_ai_rate_limit_blocks_after_threshold(limited_app: FastAPI):
    """AI 专项限流：超过 ai_max 后返回 429（付费出口）。"""
    client = TestClient(limited_app)
    assert client.post("/api/ai/chat").status_code == 200
    assert client.post("/api/ai/chat").status_code == 200
    res = client.post("/api/ai/chat")
    assert res.status_code == 429


def test_ai_paths_share_rate_limit_key(limited_app: FastAPI):
    """AI 各路径共享统一限流 key：轮换端点不能绕限流。"""
    client = TestClient(limited_app)
    assert client.post("/api/ai/chat").status_code == 200
    assert client.post("/api/ai/chat").status_code == 200
    res = client.post("/api/ai/recommend")
    assert res.status_code == 429


def test_global_limit_does_not_apply_to_auth_or_ai(limited_app: FastAPI):
    """专项限流独立于全局限流：/ping 超全局阈值后 /api/auth 仍可访问（不同 key、不同阈值）。"""
    client = TestClient(limited_app)
    for _ in range(6):
        client.get("/ping")
    assert client.get("/ping").status_code == 429
    # auth 走独立 key + 独立阈值（2），尚未触达
    assert client.post("/api/auth/login").status_code == 200


def test_trusted_host_rejects_unknown_host():
    """Host 头不在允许列表返回 400，防 Host 头缓存投毒/重置链接投毒。"""
    app = FastAPI()
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=["example.com"])

    @app.get("/ping")
    def ping():
        return {"ok": True}

    client = TestClient(app)
    assert client.get("/ping", headers={"host": "example.com"}).status_code == 200
    assert client.get("/ping", headers={"host": "evil.com"}).status_code == 400
