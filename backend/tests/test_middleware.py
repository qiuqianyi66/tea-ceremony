"""限流中间件测试：超过阈值返回 429；/health 豁免。"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.middleware import RateLimitMiddleware, reset_rate_store


@pytest.fixture()
def limited_app():
    reset_rate_store()
    app = FastAPI()
    app.add_middleware(RateLimitMiddleware, max_requests=2, window=60)

    @app.get("/ping")
    def ping():
        return {"ok": True}

    @app.get("/health")
    def health():
        return {"status": "ok"}

    return app


def test_rate_limit_blocks_after_threshold(limited_app: FastAPI):
    client = TestClient(limited_app)
    assert client.get("/ping").status_code == 200
    assert client.get("/ping").status_code == 200
    # 第三次超限
    res = client.get("/ping")
    assert res.status_code == 429
    body = res.json()
    assert body["code"] == "RATE_LIMITED"
    assert body["status"] == 429


def test_health_is_exempt_from_rate_limit(limited_app: FastAPI):
    client = TestClient(limited_app)
    for _ in range(5):
        assert client.get("/health").status_code == 200
