---
name: unit-test-write
description: 单元测试编写——TDD 垂直切片，用例顺序正常→边界→异常→幂等→状态流转，覆盖率 ≥80%。流水线阶段 5。
---

# Unit Test Write

## 触发
- 进入阶段 5 单元测试；新增/修改逻辑必须带测试。

## 工作流
1. **TDD 优先**：先写失败测试 → 最小实现 → 下一个（垂直切片，禁水平切片）。
2. **技术栈**：
   - 后端：JUnit 5 + Mockito；Controller 用 `@WebMvcTest`；Service 纯逻辑单测（mock Repository 边界）；集成测试 Testcontainers PG。
   - 前端：Vitest；组件测试（Props/Emits/五态）；composable 测试。
3. **用例顺序**：正常路径 → 边界值 → 异常路径 → 幂等 → 状态流转。
4. **行为测试三规则**：只走公共接口；不 mock 内部协作者（只 mock 网络/时钟/DB 驱动）；重构不改测试。
5. **收尾**：覆盖率 ≥80%（核心逻辑 100%）→ 测试全绿。

## 自检
- [ ] TDD 垂直切片（先红后绿）
- [ ] 正常/边界/异常/幂等/状态 用例齐全
- [ ] 覆盖率 ≥80%，核心 100%
- [ ] 全绿无跳过

## 下一步

进入 → `unit-test-ci`（CI 门禁）→ 通过后 `expert-reviewer`（专家评审）。
