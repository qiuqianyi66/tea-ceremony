"""健康检查接口测试：DB 可达返回 200 ok。"""

from fastapi.testclient import TestClient


def test_health_ok(client: TestClient):
    res = client.get("/health")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["database"] == "ok"


def test_health_not_rate_limited(client: TestClient):
    # 健康检查不被限流：连续请求均应 200
    for _ in range(5):
        assert client.get("/health").status_code == 200
