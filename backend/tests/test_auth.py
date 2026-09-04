"""认证接口测试：注册 / 登录。"""


def test_register_success(client):
    res = client.post(
        "/api/auth/register",
        json={"username": "tealover", "password": "pass-123", "display_name": "茶友"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["access_token"]
    assert data["token_type"] == "bearer"
    assert data["user"]["username"] == "tealover"
    assert data["user"]["display_name"] == "茶友"
    assert data["user"]["level"] == 1


def test_register_duplicate_username(client):
    payload = {"username": "duplicate", "password": "pass-123"}
    assert client.post("/api/auth/register", json=payload).status_code == 200
    res = client.post("/api/auth/register", json=payload)
    assert res.status_code == 400
    assert "已存在" in res.json()["detail"]


def test_login_success(client):
    client.post(
        "/api/auth/register",
        json={"username": "login_user", "password": "pass-123"},
    )
    res = client.post(
        "/api/auth/login",
        json={"username": "login_user", "password": "pass-123"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["access_token"]
    assert data["user"]["username"] == "login_user"


def test_login_wrong_password(client):
    client.post(
        "/api/auth/register",
        json={"username": "wrong_pw", "password": "pass-123"},
    )
    res = client.post(
        "/api/auth/login",
        json={"username": "wrong_pw", "password": "bad-pass"},
    )
    assert res.status_code == 401
    assert "错误" in res.json()["detail"]


def test_login_unknown_user(client):
    res = client.post(
        "/api/auth/login",
        json={"username": "nobody", "password": "pass-123"},
    )
    assert res.status_code == 401
