"""AI 代理路由测试：成功转发 / 统一 502 降级信号 / _proxy 网络失败。"""

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.routers import ai


def test_ai_recommend_success(client: TestClient, monkeypatch):
    monkeypatch.setattr(ai, "_proxy", lambda messages: "推荐绿茶，清新怡人，80度冲泡")
    res = client.post(
        "/api/ai/recommend",
        json={"time": "morning", "weather": "sunny", "mood": "calm"},
    )
    assert res.status_code == 200
    assert res.json()["content"] == "推荐绿茶，清新怡人，80度冲泡"


def test_ai_note_success(client: TestClient, monkeypatch):
    monkeypatch.setattr(ai, "_proxy", lambda messages: "今日品龙井，豆香清雅，回甘悠长")
    res = client.post(
        "/api/ai/note",
        json={"tea_name": "西湖龙井", "score": 8.6, "dimensions": {"bitterness": 2}},
    )
    assert res.status_code == 200
    assert res.json()["content"].startswith("今日品龙井")


def test_ai_chat_success(client: TestClient, monkeypatch):
    monkeypatch.setattr(ai, "_proxy", lambda messages: "泡茶水温宜 80 度")
    res = client.post(
        "/api/ai/chat",
        json={"messages": [{"role": "user", "content": "绿茶多少度"}]},
    )
    assert res.status_code == 200


def test_ai_proxy_failure_returns_502(client: TestClient, monkeypatch):
    def boom(messages):
        raise HTTPException(status_code=502, detail="AI 服务暂不可用，请稍后重试")

    monkeypatch.setattr(ai, "_proxy", boom)
    res = client.post(
        "/api/ai/recommend",
        json={"time": "morning", "weather": "sunny", "mood": "calm"},
    )
    assert res.status_code == 502
    body = res.json()
    assert body["code"] == "BAD_GATEWAY"
    assert body["status"] == 502


def test_proxy_network_failure_raises_502(monkeypatch):
    """_proxy 在第三方网络不可用时抛 502（前端据此降级）。"""
    import httpx

    class FakeClient:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def post(self, *args, **kwargs):
            raise httpx.ConnectError("network down")

    monkeypatch.setattr(httpx, "Client", lambda *a, **k: FakeClient())
    with pytest.raises(HTTPException) as exc:
        ai._proxy([{"role": "user", "content": "hi"}])
    assert exc.value.status_code == 502
