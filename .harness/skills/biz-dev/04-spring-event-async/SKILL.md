---
name: spring-event-async
description: 异步解耦——Spring 事件 + @Async（有界线程池），禁事务内远程调用/异步，afterCommit 回调。业务专项 04（替代 mq-messaging，tea 无 RocketMQ）。
---

# Spring Event Async

## 触发
- 需要异步解耦（品鉴后成长通知、AI 用量落库）；跨模块通知。

## 工作流
1. 定义领域事件（RecordCreatedEvent 等）+ `@EventListener`。
2. 写库事务内只发布事件，异步处理走 `@Async`（指定有界 executor）。
3. 远程调用/异步放 `TransactionSynchronization.afterCommit`（禁事务内执行）。
4. 异步任务错误处理 + 重试有界。

## 红线
- 禁事务内远程调用/异步（#4）；禁 Executors.newFixedThreadPool（#8）。

## 自检
- [ ] 事件在 afterCommit 后处理
- [ ] @Async 指定有界 executor
- [ ] 异步失败有处理（日志/告警）
