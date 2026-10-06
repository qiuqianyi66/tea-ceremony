---
name: coding-skill
description: 编码实现：按分层流程写代码（后端 Entity/Repository/Service/Controller，前端 Types/API/Store/Composable/Component），需求分析完成后必须使用本技能。
---

# 编码技能

按照标准流程实现功能编码，确保代码质量与架构合规。对应十阶段流水线**阶段 4（编码实现）**。

## 触发条件

- 需求分析已完成，进入实现阶段
- "实现 xx 功能" / "写一下 xx 的接口" / "加一个 xx 页面"
- 修改现有模块的业务逻辑

## 前置条件（硬门，缺失回退）

- ✅ 需求分析已完成（`.harness/changes/{feat}/summary.md` 已存在）
- ✅ 技术方案已评审，任务已拆分并明确依赖
- ❌ 若上述任一缺失，**先回到 `request-analysis`**，禁止硬编码

## 上下文准备

按需加载，规则 + Wiki 合计不超过 4 个：

| 上下文 | 何时读取 |
|---|---|
| `.harness/rules/编码规范.md` | **必读**（红线 15 条） |
| `.harness/rules/工程结构.md` | 涉及新建包/模块时 |
| `.harness/wiki/data-model.md` | 涉及 Entity/DDL 时 |
| `.harness/wiki/api-contract.md` | 涉及 API 设计时 |

**编码模式优先参照 `biz-dev-skill`**：CRUD 脚手架 (01)、分页 (02)、缓存 (03)、异步 (04)、事务 (05)、异常 (06)、校验 (07) 等，本技能只定义流程与检查点，不重复展开模式细节。

## 代码结构参照（禁发明路径）

后端（见 `.harness/rules/工程结构.md` §四）：
```
backend/src/main/java/com/tea/
├── common/       # exception / response / config / util
├── auth/         # 认证（Security + JWT）
├── tea/          # 茶叶领域（entity/repository/service/controller）
├── record/       # 品鉴记录（幂等 client_id）
├── culture/      # 茶文化
├── ware/         # 茶器
└── ai/           # Spring AI Alibaba（代理 /api/ai/*）
```

前端（见 §二）：
```
src/views → src/components → src/stores → src/services
```

## 执行纪律

1. **分批编码**：一次 ≤40% 总量 → 编译/测试 → 下一批；批批验证
2. **红线**：编码规范 15 条零违反（分层/异常/对象/事务/幂等/N+1/Flyway/线程/安全/AI 代理/Vue/数据流/设计/3D/部署门禁）
3. **禁顺手重构**：只动需求涉及的代码
4. **收尾**：自检清单 26 项逐项勾（编码规范 §六）+ 更新 summary.md

## Token 约束

- 上下文 ≤4 份；已读技能不重复读；frontmatter 描述命中才读全文

## 自检

- [ ] 编译 0 error（前后端）
- [ ] 红线 15 条零违反
- [ ] 40% 分批且批批验证
- [ ] 前置条件满足（summary 存在）
- [ ] 自检清单 26 项勾完

## 下一步

进入 → `unit-test-write`（单元测试），随后 `expert-reviewer`（专家评审）。
