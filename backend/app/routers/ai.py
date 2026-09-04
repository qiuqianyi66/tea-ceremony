"""AI 代理路由：把第三方 LLM（Pollinations）请求收敛到后端，浏览器不直连外部服务。

- 统一超时 / 失败处理：第三方不可用时返回 502，前端据此降级到规则引擎。
- 端点：/api/ai/recommend（荐茶）、/api/ai/note（茶记）、/api/ai/chat（问答）。
"""

import logging
from typing import List

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.config import AI_PROXY_MODEL, AI_PROXY_TIMEOUT, AI_PROXY_URL

logger = logging.getLogger("tea.ai")

router = APIRouter()


class ChatMessage(BaseModel):
    role: str = Field(pattern="^(system|user|assistant)$")
    content: str = Field(min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    messages: List[ChatMessage] = Field(min_length=1, max_length=20)


class RecommendRequest(BaseModel):
    time: str = Field(min_length=1, max_length=20)
    weather: str = Field(min_length=1, max_length=20)
    mood: str = Field(min_length=1, max_length=20)


class NoteRequest(BaseModel):
    tea_name: str = Field(min_length=1, max_length=50)
    score: float = Field(ge=0, le=10)
    dimensions: dict = {}


class AIResponse(BaseModel):
    content: str


def _proxy(messages: list[dict]) -> str:
    """调用 Pollinations 并返回回复文本；任何失败抛 502。"""
    try:
        with httpx.Client(timeout=AI_PROXY_TIMEOUT) as client:
            res = client.post(
                AI_PROXY_URL,
                json={"model": AI_PROXY_MODEL, "messages": messages},
            )
    except httpx.HTTPError as error:
        logger.warning("调用 Pollinations 失败: %s", error)
        raise HTTPException(status_code=502, detail="AI 服务暂不可用，请稍后重试") from error

    if res.status_code != 200:
        logger.warning("Pollinations 返回非 200: %s", res.status_code)
        raise HTTPException(status_code=502, detail="AI 服务暂不可用，请稍后重试")

    try:
        data = res.json()
        content = data.get("choices", [{}])[0].get("message", {}).get("content")
    except (ValueError, IndexError, AttributeError):
        logger.warning("Pollinations 响应解析失败")
        content = None
    if not content:
        raise HTTPException(status_code=502, detail="AI 服务返回异常")

    return content


@router.post("/recommend", response_model=AIResponse)
def ai_recommend(data: RecommendRequest) -> AIResponse:
    system = (
        "你是「一盏茶」的茶灵 AI，精通中国茶道的老师傅。根据用户的时间、天气、心情推荐一款茶。"
        "只用中文回答，语言优美雅致，不超过 80 字。"
        "格式：推荐茶品：茶名 / 理由：一句话 / 冲泡建议：水温与浸泡时间。"
    )
    user = f"现在是{data.time}，天气{data.weather}，心情{data.mood}。推荐一款茶。"
    content = _proxy([
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ])
    return AIResponse(content=content)


@router.post("/note", response_model=AIResponse)
def ai_note(data: NoteRequest) -> AIResponse:
    system = (
        "你是「一盏茶」的茶灵 AI，品茶大师。根据品鉴数据生成一段优美的茶记。"
        "只用中文，语言古雅有韵味。格式：一句诗意的开头 + 2-3 句品鉴感受，不超过 60 字。"
        "不要用评价性语言，用描述性语言。"
    )
    user = f"茶品：{data.tea_name}\n综合评分：{data.score}/10\n品鉴数据：{data.dimensions}\n请写一段品茶记。"
    content = _proxy([
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ])
    return AIResponse(content=content)


@router.post("/chat", response_model=AIResponse)
def ai_chat(data: ChatRequest) -> AIResponse:
    content = _proxy([message.model_dump() for message in data.messages])
    return AIResponse(content=content)
