---
last_updated: 2026-11-03
status: active
owner: yanha
---

# 前端存储层语义复用样张（P3 抽样，只读）

> 对应 `docs/plans/PLAN-code-reuse-sweep-2026-11-03.md` §2 P3。
> 计划要求「先出报告再决定改不改」，并给了止损线：**重复度低于 20% 就直接结论不值得动**。
> 本报告只读，未改任何代码。

## 结论（先看这条）

**不值得动。** 抽样两个目录实测重复度 **约 3–6%**，远低于计划设的 20% 阈值。

原因不是「没重复」，而是**真重复的只有 3 处同形块**（约 21 行），其余看似重复的
都是承重设计：`await initDB()` 是 22 处显式水合守卫，`services/api/` 的请求封装**早已集中**
（`services/http.ts` 的 `requestOrMock`，被 4 个模块 14 处调用）。

## 抽样范围与规模

| 目录 | 文件 | 行数 | 实测 |
|---|---|---|---|
| `src/services/storage/` | 8 个 .ts | 477 | 见下 |
| `src/services/api/` | 6 个 .ts（含 index/types） | 367 | 请求封装已集中，其余是 DTO/Vo 声明 |

## 一、`services/storage/`：3 类「看起来能提取」的模式

### ① 替换整表（真重复，3 处，21 行）

字形完全一致的 7 行块，只差表名与数组：

- `achievement.ts:14` `save()`
- `collectedWare.ts:14` `save()`
- `history.ts:18` `save()`

```
await db.transaction('rw', <表>, async () => {
  await <表>.clear()
  if (rows.length > 0) await <表>.bulkPut(rows)
})
```

**提取评估**：`replaceTable(table, rows)` 约 8 行，3 个调用点各 1 行 → 净省 ~10 行。
但收益仅 10 行，动的是持久化层（本项目在这一层的脏数据事故最多），**不建议为 10 行开一轮**。

> 注：`src/services/telemetry/outbox.ts:31` 和 `:101` 也用了 `transaction('rw')`，
> 但形状不同（容量淘汰 / 批量回写），**不属于同类重复**，不要并进去。

### ② `await initDB()` 22 处 / 6 文件（看着像重复，实际不是）

每个读写方法开头都 `await initDB()`。这是**显式水合守卫**：Dexie 表在首次访问前必须先完成
`initDB()`（schema 打开 + 迁移）。把它换成 `withDB(fn)` 包装器属于「用间接层换掉 1 行显式语句」，
调用点更难读，且会让「哪一步触发了 DB 打开」不可见。

**结论：保留原样。** 这是 P3 要防的典型伪重复。

### ③ 业务 key upsert 2 处（`settings.ts:set` / `xp.ts:save`，各 10 行）

形状相同：「按 key 查主键 → 无则 add，有则 update 首行 + 清掉历史重复行」，
两处注释都写着「与 settings.ts 同款修法（2026-10-20 排雷发现）」。

**为什么不提取**：
1. 只有 2 处，低于阈值；
2. 这段代码存在的唯一理由是 `settings`/`userXp` 两表的**历史 schema 用了 `++id` 自增主键**，
   而业务语义按 `key` 唯一。抽象成泛型 helper 会把「为什么必须这么写」的现场说明搬离调用点，
   下一个人更容易把它改回 `db.put({key, value})` —— 那正是这两处 comment 在防的 bug
   （写入永远读不到 / 每次新增重复行）。
3. 真正该做的不是提取，而是**迁移 schema 把 `key` 设成唯一主键**——那是 L3 改动，需 ADR，另开项。

## 二、`services/api/`：无债

- 4 个模块（auth 71 / garden 78 / records 125 / teas 75 行）**全部**走 `requestOrMock`（`services/http.ts`，95 行），
  调用点 14 处。请求封装、错误处理、mock 降级已集中，不存在各写一遍。
- 剩余行数是 DTO / Vo 接口声明（字段由后端契约决定，不能合并）。

**结论：这一目录 P3 可以整段关掉。**

## 三、给 P3 剩余部分的建议

按本样张的证据，`stores/`（10）和 `composables/`（15）大概率同样是「字形不重复、语义重复极少」。
建议：

1. **不要把 P3 按计划铺开成「读 83 个文件出大报告」**——样张已表明预期收益接近 0。
2. 若仍要验，只抽 `composables/` 一个目录（15 个，最可能出现生命周期清理同构），
   判据仍是 20% 阈值，出样张即止。
3. 真正有重复债的地方本轮已定位清楚：`scripts/`（P1 已收）、后端 catch（P2 已证伪）。
   **P4 里的 `localStorage` 20 处 / `new Date` 32 处** 反而更可能有真收益，但计划自己也说「单点收益小」，
   优先度应低于「修 `verify-*.cjs` 假绿」这类门禁问题（已修）。

## 四、附：P4 第 1 项（`localStorage` 直用）先判定完毕（2026-11-03）

计划要求「先逐处核实是否真有业务侧直用」。实测（`src/` 全量，含测试）：

- `localStorage.` 命中 **34 处 / 10 文件**（计划快照写 20 处 / 6 文件）。
- 其中 **15 处在测试**（`storage.spec` / `teaAI.spec` / `tea.spec` / `utils/storage.spec`）、
  2 处在 `src/test/setup.ts`（内存实现），都不是生产代码。

生产侧 17 处分布：

| 文件 | 处数 | 判定 |
|---|---|---|
| `services/storage/db.ts` | 4（另 2 处已注释） | 一次性 localStorage→IndexedDB 迁移，**该处就是要读 localStorage**，不改 |
| `services/telemetry/identity.ts` | 4 | 存储层本身，不改 |
| `services/authStorage.ts` | 3 | 存储层本身，不改 |
| `services/aiSession.ts` | 3 | 存储层本身，不改 |
| `stores/theme.ts` | 2 | **唯一的业务侧直用**（Pinia store 里直接 `localStorage.getItem('tea-theme')`） |

**顺带发现（比「合并 2 处直用」更值得记的一条）**：`src/utils/storage.ts` 已提供
`readJson / writeJson / removeKey`（含隐私模式、配额、循环引用的降级语义，且有专门 spec），
但**全库没有任何生产调用方**——`authStorage.ts` 与 `aiSession.ts` 各自手写了一遍
「try/catch + 序列化 + 静默失败」。所以真实状况是「工具函数已具备但没人用」，不是「缺工具」。

**为什么这一项仍不动**：
1. `stores/theme.ts` 存的是裸字符串（`'ming'`），换成 `writeJson` 会变成 `"ming"`（带引号），
   老数据 `JSON.parse` 抛错后回落到默认值 → **已选主题静默重置**，是回归。
2. `authStorage` / `aiSession` 换 `utils/storage` 可做到零格式变更（都是 JSON/整数边界），
   但净省约 15 行，动的是 **token 持久化路径**，收益与风险不成比例。
3. 真要做，正确顺序是先给 `utils/storage.ts` 补一条「谁是唯一 localStorage 出口」的规则并
   逐个人改，而不是顺手替换（本项目在 IndexedDB/localStorage 这一层的历史事故最多）。
