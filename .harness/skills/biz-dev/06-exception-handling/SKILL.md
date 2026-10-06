---
name: exception-handling
description: 异常处理——BusinessError 体系（BadRequest/Unauthorized/NotFound/Conflict）+ @RestControllerAdvice，禁裸抛/吞异常。业务专项 06。
---

# Exception Handling

## 触发
- 新增异常场景；统一错误响应改造。

## 工作流
1. 抛 BusinessError 子类（带 errorCode + message），禁裸抛 RuntimeException。
2. Controller 不处理异常（交给 @RestControllerAdvice 统一转 ApiResponse<T>）。
3. 技术异常（DB/IO/JSON）映射 500 + 错误码，不泄露堆栈。
4. 日志分级：业务预期 warn，非预期 error（带堆栈）。

## 红线
- 统一异常体系（#2）：禁裸抛 RuntimeException、禁 catch 吞异常。

## 自检
- [ ] 异常走 BusinessError 体系
- [ ] 无裸抛、无吞异常
- [ ] 全局 Advice 统一响应
- [ ] 不向前端泄露堆栈
