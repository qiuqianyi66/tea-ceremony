# fastapi-endpoint — 人读审查页

> 面向人的审查页。模型执行规则见 `.agents/skills/fastapi-endpoint/SKILL.md`。

## 它管什么

**过渡期旧 FastAPI 后端**接口生成规范：RESTful 路径、认证、分层、Schema 校验、错误响应。

**定义性约束**：旧后端处于过渡期，**仅维护不新增功能**（AGENTS.md §1/§7）。新功能后端走 Spring Boot 重写，本技能只管既有代码的维护性改动。

## 何时该用 / 何时不该用

**该用**：修改旧 FastAPI 后端已有接口、修 bug、按既有模式补齐路由。

**不该用**：新功能的后端实现（应进入 Spring Boot 重写流程）；与品鉴/茶文化无关的常规改动。

## 审查要点（人过一遍时核对）

- [ ] RESTful 路径用复数名词（`/api/teas`、`/api/records`），未发明怪路径
- [ ] 需登录接口加了 `Depends(get_current_user)`，无越权访问
- [ ] 路由文件只做参数与响应，业务逻辑没有堆在 Controller/router 层
- [ ] 输入用 Pydantic Schema 校验，错误响应统一（`ApiResponse` 风格）
- [ ] 没有用本技能给旧后端写新功能（新栈优先原则）

## 怎么知道它在生效

- 接口文档（/docs）可查，认证接口未带 token 返回 401
- 错误响应格式统一，前端可以按约定解析

## 对应文件

- `.agents/skills/fastapi-endpoint/SKILL.md`
- 后端代码：`backend/app/routers/`、`backend/app/schemas/`、`backend/app/models/`
