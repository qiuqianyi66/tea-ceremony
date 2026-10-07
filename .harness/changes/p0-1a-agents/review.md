# p0-1a-agents 评审记录

> 评审时间：2026-10-07 · 对象：P0-1a 五专家注册（backend ai 域）· 方式：自查 diff + 对照需求 F-1~F-7 + 测试/冒烟核验
> 结论：✅ 通过（发现 3 类问题，全部修复）。🔴 0 🟡 0

## 一、评审维度与发现

### 1. 需求覆盖（F-1~F-7）

| 需求 | 实现 | 验证 | 结论 |
|---|---|---|---|
| F-1 advisor 荐茶师 | AdvisorAgent（teas/regions/processes 检索 + 荐茶 prompt） | AdvisorAgentTest 4 测 + 冒烟 502 | ✅ |
| F-2 taster 品鉴师 | TasterAgent（最近 10 条记录 + 品鉴点评 prompt） | TasterAgentTest 5 测 | ✅ |
| F-3 brewer 冲泡师 | BrewerAgent（teawares/processes 检索 + 冲泡方案 prompt） | BrewerAgentTest 4 测 | ✅ |
| F-4 mentor 成长导师 | MentorAgent（记录 + 常识 + 成长建议 prompt） | MentorAgentTest 4 测 | ✅ |
| F-5 路由泛化 | routeToAgent 返回 AgentType；未知 400；无 agent 文化 → librarian | AgentOrchestratorTest 13 测 | ✅ |
| F-6 通用契约 | key 缺失 502 / sources / 计量旁路 | 各专家测试 + 冒烟 | ✅ |
| F-7 测试 | 30 新增 + 派发矩阵 | mvn test 127 全绿 | ✅ |

### 2. 发现的问题（本轮已修复）

1. 🔴 **MentorAgent 孤儿变量**：`context = renderContext(...)` 计算后未被使用（原 chat() 内联渲染）。修复：删除孤儿行，统一走 renderContext。
2. 🟡 **4 类重复模式**：key 检查/lastUserMessage/LLM 调用（502 兜底）/计量旁路 约 30 行 × 4 类重复。修复：提取 `BaseExpertAgent`（构造注入 + checkKey + lastUserMessage + callLlm + toVo），子类只保留 SYSTEM_PROMPT/检索/渲染/来源。重复消除、后续新专家直接继承（扩展性 ✓）。
3. 🟡 **LayerDependencyTest 静默跳过**（上次会话遗留）：`@AnalyzeClasses/@ArchTest` 组合下 surefire 报告 Tests run: 0，红线自动化形同虚设。修复：改纯编程式（唯一 @Test 入口），实测 Tests run: 1；红线（Controller 禁查库/单向依赖/禁字段注入）进入 CI 真实验证。
4. 🟢 **透明代理测试 mock 顺序坑**（复现 HANDOFF 已知坑）：service 构造先于 stub 导致 build() 返回 null → 502。修复：先 mockTransparentReply 再构造 service。

### 3. 承重墙确认

- 502 降级链（key 缺失/上游失败 → BAD_GATEWAY）保持，冒烟实测 5 专家均 502 ✓
- 计量旁路（失败不影响响应）保持 ✓
- 未知 agent 400 保持，冒烟实测 robot → 400 ✓
- librarian 回归不变（routeToLibrarian 委托）✓

## 二、验证证据

| 项 | 结果 |
|---|---|
| mvn clean test | 127 tests / 0 fail / 0 error（含架构红线 LayerDependencyTest 1 测） |
| 本地 docker 冒烟 | advisor/taster/brewer/mentor/librarian → 502（无 key 降级）；robot → 400 |
| eval-harness | 见 eval.md（七维评测） |

## 三、遗留（非本切片范围）

- 专家 prompt 版本化（S2 agent_prompts 表替换内置常量）→ P1-R 序列
- XP 成长体系后端（mentor 数据源扩充）→ P1-8
- LibrarianAgent 未并入 BaseExpertAgent（跑得好好的，不顺手重构；后续新专家统一后收敛）
