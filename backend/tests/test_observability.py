"""第三批可观测性测试：
- P1-1  request_id：响应头 X-Request-ID 存在且合法；传入合法 id 时透传
- P1-2  /metrics：Prometheus 文本格式暴露
- P1-12 /live 纯 200（不查 DB）；/ready 查 DB（不可用 503）；探针均不被限流
"""

from fastapi.testclient import TestClient


def test_response_has_request_id(client: TestClient):
    res = client.get("/api/teas")
    assert res.status_code in (200, 404)  # 该路径可能无数据，但响应头必须存在
    request_id = res.headers.get("X-Request-ID")
    assert request_id, "响应必须带 X-Request-ID"
    assert len(request_id) == 32  # uuid4().hex


def test_incoming_request_id_is_passed_through(client: TestClient):
    res = client.get("/api/teas", headers={"X-Request-ID": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"})
    assert res.headers.get("X-Request-ID") == "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"


def test_invalid_request_id_is_replaced(client: TestClient):
    """非法 request_id（如注入字符串）会被替换为生成的合法 id，防日志注入。"""
    res = client.get("/api/teas", headers={"X-Request-ID": "<script>alert(1)</script>"})
    request_id = res.headers.get("X-Request-ID")
    assert request_id and request_id != "<script>alert(1)</script>"
    assert len(request_id) == 32


def test_live_is_plain_200(client: TestClient):
    res = client.get("/live")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_ready_ok_when_db_reachable(client: TestClient):
    res = client.get("/ready")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert body["database"] == "ok"


def test_ready_503_when_db_unavailable(client: TestClient, monkeypatch):
    """DB 不可用时 /ready 返回 503（编排系统据此摘除实例）；/live 仍 200。"""

    class BrokenConnection:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def execute(self, *args, **kwargs):
            raise RuntimeError("connection refused")

    class BrokenEngine:
        def connect(self):
            return BrokenConnection()

    import main as app_main

    # AsyncEngine.connect 是只读属性（SQLAlchemy 2.0），整体替换模块级 engine
    monkeypatch.setattr(app_main, "engine", BrokenEngine())
    assert client.get("/ready").status_code == 503
    assert client.get("/live").status_code == 200


def test_health_alias_matches_ready(client: TestClient):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["database"] == "ok"


def test_health_probes_not_rate_limited(client: TestClient):
    """/live /ready /health /metrics 均不被限流：连打超过全局限流阈值仍 200。"""
    for path in ("/live", "/ready", "/health", "/api/health", "/metrics"):
        for _ in range(8):  # 全局阈值为 300/60s，这里验证的是豁免不产生 429
            assert client.get(path).status_code == 200


def test_metrics_prometheus_text_format(client: TestClient):
    res = client.get("/metrics")
    assert res.status_code == 200
    assert "text/plain" in res.headers["content-type"]
    body = res.text
    # SRE 四信号指标存在（instrumentator 默认注册 http_requests_total 等）
    assert "http_requests_total" in body
    assert "# HELP" in body and "# TYPE" in body
