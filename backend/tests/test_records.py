"""品鉴记录接口测试：鉴权、增删查列、client_id 幂等、用户数据隔离。"""


def _register_and_login(client, username="record_user"):
    """注册并登录，返回 (携带 Bearer Token 的请求头, 用户 id)。"""
    client.post(
        "/api/auth/register",
        json={"username": username, "password": "pass-123"},
    )
    res = client.post(
        "/api/auth/login",
        json={"username": username, "password": "pass-123"},
    )
    data = res.json()
    headers = {"Authorization": f"Bearer {data['access_token']}"}
    return headers, data["user"]["id"]


def _sample_record(**overrides):
    record = {
        "client_id": "record_client_1",
        "tea_name": "西湖龙井",
        "tea_id": 1,
        "brew_temp": 80,
        "brew_time": 60,
        "infusions": 3,
        "dimensions": {"bitterness": 3, "sweetness": 4},
        "overall_score": 8.5,
        "process_factor": 0.95,
        "weather": "晴",
        "mood": "平静",
    }
    record.update(overrides)
    return record


def test_records_require_auth(client):
    res = client.post("/api/records", json=_sample_record())
    assert res.status_code == 401


def test_create_and_list_records(client):
    headers, user_id = _register_and_login(client)
    created = client.post("/api/records", json=_sample_record(), headers=headers)
    assert created.status_code == 200
    record = created.json()
    assert record["id"] > 0
    assert record["tea_name"] == "西湖龙井"
    assert record["user_id"] == user_id

    listed = client.get("/api/records", headers=headers)
    assert listed.status_code == 200
    assert len(listed.json()) == 1
    assert listed.json()[0]["client_id"] == "record_client_1"


def test_get_record_by_id(client):
    headers, _ = _register_and_login(client)
    record_id = client.post("/api/records", json=_sample_record(), headers=headers).json()["id"]

    res = client.get(f"/api/records/{record_id}", headers=headers)
    assert res.status_code == 200
    assert res.json()["tea_name"] == "西湖龙井"


def test_get_missing_record_404(client):
    headers, _ = _register_and_login(client)
    res = client.get("/api/records/99999", headers=headers)
    assert res.status_code == 404


def test_delete_record(client):
    headers, _ = _register_and_login(client)
    record_id = client.post("/api/records", json=_sample_record(), headers=headers).json()["id"]

    res = client.delete(f"/api/records/{record_id}", headers=headers)
    assert res.status_code == 200

    assert client.get(f"/api/records/{record_id}", headers=headers).status_code == 404


def test_client_id_idempotent(client):
    """同一 client_id 重复提交应返回同一条记录（离线同步幂等）。"""
    headers, _ = _register_and_login(client)
    first = client.post("/api/records", json=_sample_record(), headers=headers).json()
    second = client.post("/api/records", json=_sample_record(), headers=headers).json()

    assert first["id"] == second["id"]
    listed = client.get("/api/records", headers=headers).json()
    assert len(listed) == 1


def test_records_isolated_between_users(client):
    """不同用户不能看到彼此的品鉴记录。"""
    headers_a, _ = _register_and_login(client, "user_a")
    headers_b, _ = _register_and_login(client, "user_b")

    client.post("/api/records", json=_sample_record(), headers=headers_a)

    listed_b = client.get("/api/records", headers=headers_b)
    assert listed_b.status_code == 200
    assert listed_b.json() == []

