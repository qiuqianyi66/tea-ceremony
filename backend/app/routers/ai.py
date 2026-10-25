"""AI 代理路由：把第三方 LLM 请求收敛到后端，浏览器不直连外部服务。

- 供应商：DeepSeek 官方 API（OpenAI 兼容接口）。
- 统一超时 / 失败处理：第三方不可用时返回 502，前端据此降级到规则引擎。
- 熔断（P1-13）：连续 5 次失败后开启 30s，期间不再调用 LLM，直接快速失败（<100ms），
  防止 DeepSeek 故障时所有请求都等 30s 超时形成雪崩；30s 后半开放行一次探测。
- 端点：/api/ai/chat（问答）。recommend/note 已于 2026-10-22 D9 退役
  （荐茶能力由新栈 advisor 专家覆盖，见 docs/architecture/backend-migration-status.md §3）。
"""

import asyncio
import logging

import httpx
from fastapi import APIRouter, HTTPException
from pybreaker import CircuitBreaker
from pydantic import BaseModel, Field

from app.config import (
    AI_PROXY_KEY,
    AI_PROXY_MODEL,
    AI_PROXY_TIMEOUT,
    AI_PROXY_URL,
    AI_RETRY_BACKOFF,
)

logger = logging.getLogger("tea.ai")

router = APIRouter()

# 熔断器（P1-13）：连续 5 次失败后开启 30s，期间不再调用 LLM 直接快速失败（<100ms）。
# 说明：pybreaker 1.4.1 的 call_async/calling 对 asyncio 有缺陷（call_async 引用未定义的
# gen；calling 在 await 场景下错误处理失真），故只用其公开状态机 API
# （open() / close() / current_state，open 后 reset_timeout 自动转 half-open 放行探测），
# 失败计数由本模块用 asyncio.Lock 维护。
ai_breaker = CircuitBreaker(fail_max=5, reset_timeout=30)
_ai_failures = 0
_ai_failures_lock = asyncio.Lock()


class ChatMessage(BaseModel):
    role: str = Field(pattern="^(system|user|assistant)$")
    content: str = Field(min_length=1, max_length=4000)


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1, max_length=20)


class AIResponse(BaseModel):
    content: str


async def _call_llm(messages: list[dict]) -> str:
    """调用 LLM 并返回回复文本；任何失败抛 502。

    重试策略（P0-7）：网络错误与 5xx 为瞬时故障，退避 0.5 * 2**n 秒后重试 1 次；
    4xx 为请求或供应商拒绝，重试无意义，直接 502。
    """
    headers = {"Content-Type": "application/json"}
    if AI_PROXY_KEY:
        headers["Authorization"] = f"Bearer {AI_PROXY_KEY}"
    payload = {"model": AI_PROXY_MODEL, "messages": messages}
    timeout = httpx.Timeout(AI_PROXY_TIMEOUT)
    async with httpx.AsyncClient(timeout=timeout) as client:
        for attempt in range(2):  # 首次 + 1 次重试
            try:
                res = await client.post(AI_PROXY_URL, headers=headers, json=payload)
            except httpx.HTTPError as error:
                logger.warning("调用 LLM 失败(第%d次): %s", attempt + 1, error)
                if attempt == 0:
                    await asyncio.sleep(AI_RETRY_BACKOFF * (2**attempt))
                    continue
                raise HTTPException(status_code=502, detail="AI 服务暂不可用，请稍后重试") from error

            if res.status_code == 200:
                try:
                    data = res.json()
                    content = data.get("choices", [{}])[0].get("message", {}).get("content")
                except (ValueError, IndexError, AttributeError):
                    logger.warning("LLM 响应解析失败")
                    content = None
                if not content:
                    raise HTTPException(status_code=502, detail="AI 服务返回异常")
                return content

            if res.status_code >= 500 and attempt == 0:
                logger.warning("LLM 返回 5xx(第%d次): %s", attempt + 1, res.status_code)
                await asyncio.sleep(AI_RETRY_BACKOFF * (2**attempt))
                continue

            logger.warning("LLM 返回非 200: %s", res.status_code)
            raise HTTPException(status_code=502, detail="AI 服务暂不可用，请稍后重试")


async def _proxy(messages: list[dict]) -> str:
    """熔断保护的 LLM 调用入口（P1-13）。

    - 熔断开启（open）：不调用 LLM，直接 502 快速失败，前端降级规则引擎。
    - 调用失败：计数 +1，连续 fail_max 次后 open（30s 内快速失败）。
    - 调用成功：清零失败计数；半开状态下的探测成功会关闭熔断。
    """
    global _ai_failures
    if ai_breaker.current_state == "open":
        logger.warning("AI 熔断开启，快速失败（30s 后自动探测恢复）")
        raise HTTPException(status_code=502, detail="AI 服务暂不可用，请稍后重试")

    try:
        content = await _call_llm(messages)
    except HTTPException:
        async with _ai_failures_lock:
            _ai_failures += 1
            if _ai_failures >= ai_breaker.fail_max:
                ai_breaker.open()
                _ai_failures = 0
                logger.warning("AI 连续失败 %d 次，熔断开启 %ds", ai_breaker.fail_max, ai_breaker.reset_timeout)
        raise

    async with _ai_failures_lock:
        _ai_failures = 0
        if ai_breaker.current_state == "half-open":
            ai_breaker.close()
    return content


@router.post("/chat", response_model=AIResponse)
async def ai_chat(data: ChatRequest) -> AIResponse:
    content = await _proxy([message.model_dump() for message in data.messages])
    return AIResponse(content=content)
