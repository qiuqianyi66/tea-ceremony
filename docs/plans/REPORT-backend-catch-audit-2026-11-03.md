---
last_updated: 2026-11-03
status: active
owner: yanha
---

# 后端 catch 块分类报告（P2 第 1 步，只读）

> 对应 `docs/plans/PLAN-code-reuse-sweep-2026-11-03.md` §2 P2 第 1 步「出重复清单报告（只读，不改代码）」。
> 本报告不改任何后端代码。

## 结论（先看这条）

**P2 无事可做。** 计划假设的「33 个文件里 67 处本地 catch 在做重复包装、A 类大概率该删」实测不成立：
A 类（catch 后转 `ApiResponse`/`ResponseEntity` 返回）**0 处**。没有可删的重复包装。

## 方法与口径

- 机器抽取 `backend/src/main/java` 下全部 Java 文件的 `catch` 块（括号匹配取完整块体），再用规则初分三类，然后逐块人读复核。
- A 类 = 块体内出现 `ApiResponse` 或 `ResponseEntity`；B 类 = 块体内出现 `throw`；C 类 = 其余（降级/跳过/清理后继续）。
- 实测规模：**180 个 Java 文件 / 65 处 catch / 30 个文件含 catch**。

| 类别 | 处数 | 含义 | 处置 |
|---|---|---|---|
| A | **0** | catch 后返回 `ApiResponse` | 无对象可删 |
| B | 11 | catch 后抛出（含转译后抛） | 全部保留，逐条有注释说明 |
| C | 54 | 降级 / 跳过 / 清理后继续 | 保留（计划 §2 已定「C 类一律不动」） |

## 计划前提的三处修正（实测）

| 项 | 计划写的 | 实测 |
|---|---|---|
| catch 块 | 67 处 / 33 文件 | **65 处 / 30 文件** |
| A 类（该删的重复包装） | 「33 个文件里还有 67 处本地 catch 在做重复包装」 | **0 处** |
| `GlobalExceptionHandler` 处理器 | 8 个 | **7 个**（BusinessException / MethodArgumentNotValid / HttpMessageNotReadable / MethodArgumentTypeMismatch / HttpRequestMethodNotSupported / NoResourceFound / Exception） |
| `ApiResponse.ok(` | 「全库只有 1 处」 | **该方法不存在**；真正的工厂是 `ApiResponse.success(`，**29 处 / 13 文件**；`ApiResponse.error(` 10 处。Controller 显式包 `ApiResponse<T>`，包装方式无歧义 |
| `@RestController` | 16 | **14**（`@Service` 21 一致、`log.*` 73/31 与 72/31 一致） |

结论含义：全局异常处理**已经在位且被调用方正确使用**，不存在「基础设施就绪、调用方没跟上」的落差。

## B 类 11 处（全部保留）

| 位置 | 为什么留 |
|---|---|
| `LibrarianAgent:135` | 配额/鉴权异常原样上抛：换路径重跑只会再烧配额 |
| `AiCallExecutor:125` | 业务异常不重试、不被兜底掩盖；先记指标再上抛 |
| `AiCallExecutor:151` / `:155` | 超时/中断先 `future.cancel(true)` 再上抛（否则挂起连接继续跑） |
| `AiCallExecutor:158` | `ExecutionException` 拆包，按 cause 类型重抛 |
| `AiUsageLogger:36` | 落库失败先计数再原样上抛，调用方已有降级语义 |
| `ExperimentService:134` | 拿不到 SHA-256 直接失败（降级到 hashCode 会悄悄改变分桶，把用户洗到另一组） |
| `QualityJudgeService:131` | 序列化失败转 `IllegalStateException` |
| `OnnxEmbeddingModel:163` | ONNX 推理失败转 `IllegalStateException` |
| `LocalFallbackService:80` | 有旧快照则答旧数据，否则上抛 |
| `AiChatService:309` | 客户端断连/写失败终止流 |

## C 类 54 处里的两簇「形状重复」（评估后不提取）

1. **幂等回查 3 处**：`GardenPlantService:37`、`TastingRecordService:72`、`GardenEnergyService:104`。
   形状都是「save 撞唯一索引 → 按 client_id 回查 → 返回已有行」，只差 repo/Vo/文案。
   不提取理由：要抽象成 `saveIdempotent(save, requery, mapper, msg)` 得传 4 个 lambda，
   调用点比现在更难读，且动的是**写事务路径**（计划自己标注风险中）。净省行数 ≈ 0–5。
2. **AI 工具 catch 5 处**：`BrewAdviceTools`×3、`BrewParamTools:110`、`CultureQueryTools:99`、`TastingRecordTools:97`
   都是 `log.warn("xxx 工具查询失败：{}", e.getMessage()); return ERROR;`。
   不提取理由：这些方法是 Spring AI `@Tool`，包一层会改工具边框（注册/签名/错误语义），收益 6 行不到。

## 附带发现（本次未动）

1. **`audit-redlines` R2 覆盖不全**：R2 只匹配 `catch (Exception)` / `catch (RuntimeException)` 的空块，
   对**具体异常类**的空 catch 不报。实证：`GardenEnergyService:52` 是空块（只有注释），
   `node scripts/audit-redlines.cjs` 仍输出 `ERRORS: []`。该处是有意的幂等忽略，不算缺陷；
   但 R2 的判据与「禁 catch 吞异常」这条红线的字面范围不一致，需要决定是否扩到所有异常类型。
2. `backend/` Java 文件数 180，计划快照写 261——差距来自计划把 `backend/src/test` 或其它目录也算进去了，
   本报告只统计 `src/main/java`。

## 建议

1. **P2 关闭**，不产出代码改动。把本报告作为结论存档，避免下个会话重复摸底。
2. 下一轮走 **P3**（前端语义重复，先出报告）。但注意：P3 的前提是「重复度 ≥20% 才值得动」，
   而 P1/P2 的实测都表明计划里的小时数级预估偏乐观，P3 建议先只做一个目录（如 `services/storage/` 8 模块）
   出样张，确认重复度真实存在再铺开。
