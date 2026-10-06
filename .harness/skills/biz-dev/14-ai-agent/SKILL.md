---
name: ai-agent
description: AI 多智能体——Spring AI Alibaba 编排（5 专家：荐茶/品鉴/文化/冲泡/成长），prompt 版本管理 + Schema 校验 + 灰度。tea 专属 14。
---

# AI Agent

## 触发
- AI 功能开发（荐茶/品鉴分析/文化问答/冲泡建议/成长洞察）；/api/ai/* 后端代理。

## 工作流
1. 5 专家角色（技术命名）：RecommendAgent / TastingAgent / CultureAgent / BrewCoach / GrowthMentor（ADR-011）。
2. Prompt 版本管理（agent_prompts 表 + 灰度，禁硬编码 prompt）。
3. 输出 Schema 强校验（未知版本拒绝，防模型幻觉字段）。
4. 调用编排：超时/重试/熔断；token 计量落 ai_usage_logs。
5. 敏感数据不入 prompt；文化事实用 RAG 检索（15-rag-pipeline）。

## 红线
- AI 请求必须走后端代理（#10）；降级链不可删（#10 + 16-ai-fallback）。

## 自检
- [ ] 请求走 /api/ai/*
- [ ] prompt 版本化 + Schema 校验
- [ ] 超时/重试/熔断就位
- [ ] token 计量 + 敏感数据隔离
