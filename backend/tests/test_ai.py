"""AI 代理路由测试：成功转发 / 统一 502 降级信号 / 异步重试策略。"""

import httpx
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.routers import ai


class FakeResponse:
    def __init__(self, status_code: int, json_data: dict | None = None):
        self.status_code = status_code
        self._json = json_data

    def json(self):
        return self._json


class FakeClient:
    """按序消费 responses 的假 AsyncClient；元素可为异常或响应。"""

    def __init__(self, responses: list):
        self.responses = list(responses)
        self.calls = 0

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    async def post(self, *args, **kwargs):
        self.calls += 1
        item = self.responses.pop(0)
        if isinstance(item, Exception):
            raise item
        return item


def _patch_client(monkeypatch, responses: list) -> FakeClient:
    client = FakeClient(responses)
    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **k: client)
    # 退避设为 0，测试不等待
    monkeypatch.setattr(ai, "AI_RETRY_BACKOFF", 0)
    return client


def test_ai_recommend_success(client: TestClient, monkeypatch):
    async def fake_proxy(messages):
        return "推荐绿茶，清新怡人，80度冲泡"

    monkeypatch.setattr(ai, "_proxy", fake_proxy)
    res = client.post(
        "/api/ai/recommend",
        json={"time": "morning", "weather": "sunny", "mood": "calm"},
    )
    assert res.status_code == 200
    assert res.json()["content"] == "推荐绿茶，清新怡人，80度冲泡"


def test_ai_note_success(client: TestClient, monkeypatch):
    async def fake_proxy(messages):
        return "今日品龙井，豆香清雅，回甘悠长"

    monkeypatch.setattr(ai, "_proxy", fake_proxy)
    res = client.post(
        "/api/ai/note",
        json={"tea_name": "西湖龙井", "score": 8.6, "dimensions": {"bitterness": 2}},
    )
    assert res.status_code == 200
    assert res.json()["content"].startswith("今日品龙井")


def test_ai_chat_success(client: TestClient, monkeypatch):
    async def fake_proxy(messages):
        return "泡茶水温宜 80 度"

    monkeypatch.setattr(ai, "_proxy", fake_proxy)
    res = client.post(
        "/api/ai/chat",
        json={"messages": [{"role": "user", "content": "绿茶多少度"}]},
    )
    assert res.status_code == 200


def test_ai_proxy_failure_returns_502(client: TestClient, monkeypatch):
    async def boom(messages):
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


async def test_proxy_network_failure_raises_502(monkeypatch):
    """_proxy 在第三方网络不可用时重试一次后抛 502（前端据此降级）。"""
    _patch_client(monkeypatch, [httpx.ConnectError("network down"), httpx.ConnectError("network down")])
    with pytest.raises(HTTPException) as exc:
        await ai._proxy([{"role": "user", "content": "hi"}])
    assert exc.value.status_code == 502


async def test_proxy_5xx_retries_once_then_success(monkeypatch):
    """5xx 瞬时故障：退避后重试一次，第二次成功即返回内容。"""
    client = _patch_client(monkeypatch, [
        FakeResponse(500, {"error": "upstream"}),
        FakeResponse(200, {"choices": [{"message": {"content": "好茶"}}]}),
    ])
    assert await ai._proxy([{"role": "user", "content": "hi"}]) == "好茶"
    assert client.calls == 2


async def test_proxy_5xx_twice_raises_502(monkeypatch):
    """连续两次 5xx：重试后仍失败，抛 502。"""
    client = _patch_client(monkeypatch, [
        FakeResponse(500, {"error": "upstream"}),
        FakeResponse(503, {"error": "still down"}),
    ])
    with pytest.raises(HTTPException) as exc:
        await ai._proxy([{"role": "user", "content": "hi"}])
    assert exc.value.status_code == 502
    assert client.calls == 2


async def test_proxy_4xx_no_retry(monkeypatch):
    """4xx 为请求/供应商拒绝，不重试，直接 502。"""
    client = _patch_client(monkeypatch, [FakeResponse(400, {"error": "bad request"})])
    with pytest.raises(HTTPException) as exc:
        await ai._proxy([{"role": "user", "content": "hi"}])
    assert exc.value.status_code == 502
    assert client.calls == 1
