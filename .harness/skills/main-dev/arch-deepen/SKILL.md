---
name: arch-deepen
description: 浅模块深化扫描：找"接口窄+实现薄"的 wrapper/透传层，给出深化成深模块的方向。当用户要求架构体检、重构机会扫描、降低 AI 导航成本，或生产级收敛期定期架构回顾时触发。
type: flow
---

# 浅模块深化扫描（arch-deepen）

主动找架构摩擦点：哪些模块藏不住复杂度，导致调用方被迫知道内部细节。与 expert-reviewer（查现有代码有没有错）、quality-audit（查规范有没有破）分工。

核心判据是 **depth-as-leverage**：调用方从每单位接口要学的行为量。接口小但藏得住大量行为=深；接口几乎和实现一样复杂=浅。**不用实现行数/接口行数比率**——那会奖励 padding 实现。

## 触发条件

- 用户要求"架构体检 / 找重构机会 / 哪些模块该深化 / 降低 AI 导航成本"
- V4 生产级收敛期的定期架构回顾
- 新模块上线后满 1 个月，回看是否退化成 wrapper
- 不触发：单点 bug 修复（走 trouble-shooting）、新功能开发（走 request-analysis）、分层方向违规（ArchUnit 已机械管）

## 前置条件（硬门，缺失回退）

- 已读 `.harness/rules/工程结构.md`（模块边界）
- 已读 `docs/architecture/system-overview.md`（分层与数据流）
- ArchUnit 绿：`cd backend && mvn test -Dtest=LayerDependencyTest`（分层方向是底线，本技能不重复查）
- 明确扫描范围：全库或指定模块；未指定默认前端 `src/` + 后端 `backend/src/main/java/`

## 术语（全报告统一用词，禁止漂移）

- **模块**：有接口 + 实现的单元（组件/service/类/跨层切片）。不用"unit/component/service/boundary"。
- **接口**：调用方要正确使用模块必须知道的一切——类型签名 + 不变量 + 顺序约束 + 错误模式 + 必需配置 + 性能特征。不是 TypeScript `interface` 关键字，也不只是 public methods。
- **深度（depth）**：调用方/测试从每单位接口能行使的行为量。深=大量行为藏在小接口后；浅=接口几乎和实现一样复杂。
- **seam**：不改这个地方就能改行为的位置（Michael Feathers）。深化发生在 seam，不改模块外部行为。不用"boundary"（DDD 已占用）。
- **杠杆（leverage）**：深度给调用方的回报——一份实现被 N 个调用方 + M 个测试复用。
- **locality**：深度给维护者的回报——改动/bug/知识/测试集中在一处，修一处处处生效。

## 核心判断法：Deletion Test

对每个候选模块问：**想象删掉它，会发生什么？**

- 复杂度**消失** → 它是 pass-through（浅模块，该深化或删除）。
- 复杂度在 **N 个调用方那里重现** → 它 earn its keep（深模块，别动）。

辅助判断：
- **接口即测试面**：调用方和测试穿过同一个 seam。如果要测穿到接口内部，模块形状错了。
- **一个 adapter 是假设的 seam，两个 adapter 才是真 seam**：不要为可能变化的东西提前加 seam。
- **深度是接口的属性，不是实现的**：深模块内部可以由小的、可 mock 的、可替换的部件组成，只要它们不在接口上。

## 浅模块信号清单

### 前端（src/）

1. **重复样板类型**：同一个 `ApiResponse<T>` / 分页结构 / 错误码 union 在 ≥2 个 `services/api/*.ts` 里各自重新 interface 一遍。**本项目已实测（2026-10-10）：`ApiResponse<T>` 在 teas.ts / records.ts / garden.ts / auth.ts 重复 4 次**——每加一个 api 文件就抄一遍，协议改了要改 4 处。
2. **散落 mock 兜底**：每个 api 方法各自写一份 `{ code: 'OK', data: {...} }` mock 对象，协议漂移时要改 N 处。**本项目已实测：`code: 'OK'` 在 5 个 api 文件 7 处**（teas/records/auth/garden/__tests__）。
3. **透传组件**：组件 `<template>` 只转发 props/emits，无自身状态/业务逻辑（Grep `defineProps` 后函数体 <5 行）。**未在本项目实测，命中后再报**。
4. **空壳 store / 贫血 composable**：Pinia store 只镜像组件 ref 无派生；`useXxx()` 只返回 ref 无业务规则。**未在本项目实测**。
5. **re-export 串层**：`index.ts` 里 `export * from './X'` 串了 3 层以上，找文件要跳 4 次。**未在本项目实测**。

### 后端（backend/src/main/java/）

> 后端重写中，旧 FastAPI 仅维护。以下信号在 Spring Boot 代码中**未实测**，命中后再报；重写过渡期优先看前端真命中项。

1. **DTO↔Entity 一字不差互转**：字段全同，converter 是纯 getter/setter 搬运（不是 Vo.from 这种带逻辑的映射）
2. **贫血 Entity**：只有 getter/setter，业务规则散落在 Service（评分模型本应在 Entity，红线见编码规范）
3. **重复 Vo.from 静态方法**：N 个 Vo 各写一遍相似的 `from(Entity)`，无公共映射层
4. **空壳 config**：`@Configuration` 类只 new 一个 Bean，无条件/属性绑定

### 排除项（这些不是浅模块，是正确设计）

- Controller 薄（参数 + 响应）——ArchUnit 强制，正确
- Repository 接口薄——Spring Data JPA 正确用法
- 纯 DTO/VO/叶子组件（纯展示图标）——数据载体本就该薄
- `toLocalXxx(dto)` 这种带 null 兜底/字段重命名的转换函数——它藏住了后端 snake_case 协议，是深模块（本项目 teas.ts/records.ts 属此类）
- `upsert` 带幂等/并发兜底的 Service 方法——正确厚实现

## 流程

1. **按范围扫信号清单**：用 Grep/Glob 定位候选，不要全库逐文件读。
   - 前端重复类型：Grep `interface ApiResponse` 在 `src/services/` 下的出现次数（≥2 即候选）
   - 前端散落 mock：Grep `code: 'OK'` 在 `src/services/api/` 下的出现次数
   - 后端贫血 Vo：Grep `static .*Vo from\(` 看映射模式是否重复
2. **每条候选过 Deletion Test + 三问**：
   - Deletion Test：删掉它，复杂度消失=pass-through（深化候选）；复杂度在 N 个调用方重现=earn its keep（划掉）。
   - 接口即测试面：测试是否穿过接口？要测穿到内部=形状错了。
   - 深化后接口能否变宽（一个调用方解决一类问题）？否 → 杠杆低，划掉。
   - 深化是否破坏承重墙（AI 降级链/评分模型/离线同步）？是 → 降级为"待观察"，不推进。
3. **最多选 5 条高杠杆机会**写报告；超出的列"观察清单"不展开。清单过长没人做。
4. **产出报告**：`docs/architecture/deepen-YYYY-MM-DD.md`（新文件，不覆盖历史）。

### 报告格式

```markdown
# 浅模块深化扫描 · YYYY-MM-DD

范围：<全库 / 指定模块>
基线：ArchUnit 绿 / type-check 绿 / 后端测试绿

## 高杠杆机会（≤5）

### D1. <一句话标题>
- 位置：<file:line>
- 类型：<前端透传组件 / 后端一行 Service / ...>
- 为什么浅：<现状，一两行>
- 深化方向：<接口怎么变宽、复杂度藏到哪>
- 收益：<可测性 / AI 导航成本 / N 处调用方受益>
- 风险：<深化可能破坏什么>

## 观察清单（不推进，下次再看）
- <file:line> — <一句话原因>
```

## 纪律

- **只出报告，不改代码**。深化是单独的 refactor PR，走 request-analysis + expand-contract（AGENTS.md §9）。
- 禁止把"薄 Controller / 薄 Repository"当成浅模块报——那是正确分层。
- 禁止一次报超过 5 条高杠杆机会；贪多等于没报。
- 报告引用文件必须带行号；行号来自当次 Grep/Read，不抄上次报告。
- 深化建议不许发明新抽象；优先把已有但散落的逻辑收进现有模块。

## 检查清单

- [ ] ArchUnit / type-check / 后端测试基线绿
- [ ] 每条候选过三问（调用方知情 / 接口可宽 / 不碰承重墙）
- [ ] 高杠杆机会 ≤5 条
- [ ] 每条带 file:line（当次实测，不抄旧报告）
- [ ] 报告已落 `docs/architecture/deepen-YYYY-MM-DD.md`
- [ ] 未把薄 Controller / 薄 Repository 误报为浅模块
- [ ] 未改任何业务代码

## 下一步

- 报告交付用户 → 用户挑 D1-Dn → 选中项各自走 request-analysis 立项 refactor PR。
- 深化落地后更新本报告"观察清单"里该条状态。
