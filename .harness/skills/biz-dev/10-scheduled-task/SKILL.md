---
name: scheduled-task
description: 定时任务——@Scheduled + ShedLock 防重 + 幂等 + 失败告警，禁 fixedRate 依赖执行时长。业务专项 10（AI 成本日统计/缓存预热）。
---

# Scheduled Task

## 触发
- 定时任务（AI 用量日统计、缓存预热、数据归档）。

## 工作流
1. `@Scheduled(cron=...)` 或 fixedDelay（禁 fixedRate 依赖执行时长）。
2. 多实例下 ShedLock 防重复执行。
3. 任务方法幂等（可重入无副作用）。
4. 失败告警 + 重试有界（禁无限重试）。

## 自检
- [ ] cron/fixedDelay 显式
- [ ] ShedLock 防重（多实例）
- [ ] 任务幂等
- [ ] 失败告警就位
