"""茶园接口测试：鉴权、幂等 upsert、列表、用户数据隔离。"""


def _register_and_login(client, username="garden_user"):
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


def _sample_plant(**overrides):
    plant = {
        "client_id": "plant_client_1",
        "region_id": "hangzhou",
        "tea_id": "longjing",
        "planted_at": "2026-09-01T00:00:00",
        "last_watered_at": "2026-09-08T00:00:00",
        "water_level": 100,
        "pruned": False,
        "status": "growing",
        "harvest_count": 0,
    }
    plant.update(overrides)
    return plant


def test_garden_plants_require_auth(client):
    res = client.post("/api/garden-plants", json=_sample_plant())
    assert res.status_code == 401


def test_upsert_and_list_plants(client):
    headers, user_id = _register_and_login(client)
    created = client.post("/api/garden-plants", json=_sample_plant(), headers=headers)
    assert created.status_code == 200
    plant = created.json()
    assert plant["id"] > 0
    assert plant["region_id"] == "hangzhou"
    assert plant["user_id"] == user_id

    listed = client.get("/api/garden-plants", headers=headers)
    assert listed.status_code == 200
    assert len(listed.json()) == 1
    assert listed.json()[0]["client_id"] == "plant_client_1"


def test_client_id_idempotent_upsert(client):
    """同一 client_id 重复提交返回同一条记录；更新字段生效（如采摘后状态）。"""
    headers, _ = _register_and_login(client)
    first = client.post("/api/garden-plants", json=_sample_plant(), headers=headers).json()

    second = client.post(
        "/api/garden-plants",
        json=_sample_plant(status="harvested", harvest_count=1, harvested_at="2026-09-08T12:00:00"),
        headers=headers,
    ).json()

    assert first["id"] == second["id"]
    assert second["status"] == "harvested"
    assert second["harvest_count"] == 1
    assert len(client.get("/api/garden-plants", headers=headers).json()) == 1


def test_plants_isolated_between_users(client):
    headers_a, _ = _register_and_login(client, "user_a")
    headers_b, _ = _register_and_login(client, "user_b")

    client.post("/api/garden-plants", json=_sample_plant(), headers=headers_a)

    listed_b = client.get("/api/garden-plants", headers=headers_b)
    assert listed_b.status_code == 200
    assert listed_b.json() == []
