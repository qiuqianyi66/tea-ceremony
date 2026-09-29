# Global Skills V2・最终执行计划（Final Plan）

> 定位：
>
> **唯一执行依据**
>
> 。前置决策已全部封闭 —— 架构见 
>
> `Global-Skills-V2-Blueprint.md`
>
> ，选型与规则见 
>
> `Global-Skills-V2-开源选型与实施计划-终稿.md`
>
> （用户定稿）。本文件把规则落成可执行的分阶段计划，执行时不再逐项拍板。
> 日期：2026-09-29

## ✅ 执行状态（2026-09-29 更新）

- **Phase 0** 备份 ✅（77 目录 → `Temp\skills-backup-20260929-v2`，706 SKILL.md hash 基线）
- **Phase 1** 清理合并 ✅（22 → 4 合并技能，删 19，61 目录全绿）
- **Phase 2** 开源入库 ✅（SivaLabs + ECC，70 目录，SOURCES.md 溯源）
- **Phase 3** 自造 31 项 ✅（P0 8 / P1 13 / P2 10，101 目录全绿）
- **Phase 4** 体检与审计 ✅（12 组冲突审计 + 10 条路由抽样，见 `技能库体检清单.md`）
- **Phase 5** 收口 ✅（ADR-008 已入 CONTEXT.md）
- 最终规模：**101 个全局技能**（原计划 104 量级，落在 100-120 目标内）



***

## 1. 完成定义（验收标准，来自终稿 §5.4）

Global Skills V2 完成的标准**不是 "新增了 41 个目录"**，而是：

> **Agent 能在 Java / Spring Boot / Data / Distributed / DevOps / AI Backend / Frontend / Design / Vibe Coding 之间正确选择 Skill，同时保持清晰路由，不因 Skill 数量增加而降低执行质量。**

最终原则：

> **Global 负责通用判断与复用；Project 负责项目特化；开源负责提供成熟素材；自造负责补齐工程判断；Router 负责决定什么时候使用谁。**

**验收证据**：体检清单中每个技能有 1 个正触发 + 1 个负触发测试通过记录；相邻冲突组零重叠；抽查 10 条典型用户请求路由命中正确技能。

## 2. 执行规则（生效中，来自终稿 §5.1）



1. 许可证未核清：**不装**。

2. 来源质量不足：**不装，改为自造**。

3. 与现有 Skill 重叠：**先合并边界，再决定保留哪一个**。

4. 开源有价值但不完整：**吸收后改造，不原样堆入**。

5. 项目特化能力：**继续留在 Project Skills**。

6. 生产级能力：**必须有验证、失败处理和可观测性要求**。

7. 所有新增 Skill **必须经过触发测试和冲突审计**。

## 3. 溯源与许可规范（来自终稿 §5.2）

每个采用或改造的开源 Skill 在入库时写入 `SOURCES.md`（技能库根目录新建）：



```
source:
  repository: <repo>
  path: <path>
  license: <license>
  version_or_commit: <version-or-commit>
  retrieved: 2026-09-29
  adaptation: direct | modified
```

**禁止无来源、无许可证记录、无版本信息的内容直接进入 Global。**

## 4. 验收 Gate（每个新技能必过，来自终稿 §5.3）



| # | Gate           | 检查项                                                          |
| - | -------------- | ------------------------------------------------------------ |
| 1 | **Structure**  | 目录、SKILL.md、frontmatter（name/description）正确；references 路径可解析 |
| 2 | **Content**    | 有触发条件、边界、执行流程、验证方法；无 "handle errors appropriately" 式空话       |
| 3 | **Routing**    | 正触发、负触发、相邻 Skill 冲突测试通过（skill-creator 流程跑 2-3 条 prompt）      |
| 4 | **Production** | 后端 / 基础设施类补齐安全、性能、故障处理、可观测性                                  |

Gate 不过 → 回炉，不进 Global。

## 5. 映射总表（41 项最终来源）

### 🟢 开源直接装（9 项）



| 技能                        | 来源                        | 安装 / 处理                                                                           |
| ------------------------- | ------------------------- | --------------------------------------------------------------------------------- |
| spring-boot               | SivaLabs                  | `npx skills add sivalabs-agent-skills --skill spring-boot` → 改名 `spring-boot`，记溯源 |
| spring-web                | SivaLabs（MVC REST ref）    | 装后微调，补 OpenAPI / 版本化 / 幂等边界                                                       |
| spring-data               | SivaLabs（JPA/Service ref） | 直接装                                                                               |
| jpa-hibernate             | SivaLabs（JPA ref）         | 直接装（N+1 / 锁 / 批处理已含）                                                              |
| spring-testing            | SivaLabs 测试策略             | 直接装（分层测试表 + Testcontainers 已含）                                                    |
| testcontainers            | SivaLabs（wiring ref）      | 直接装                                                                               |
| spring-modulith           | SivaLabs + verifier       | 两个技能一起装                                                                           |
| event-driven-architecture | developer-kit             | 装前核许可，合格才装                                                                        |
| java-code-review          | SivaLabs                  | 装（SOFTWARE ENGINEERING 补充）                                                        |

### 🟡 开源改造（4 项）



| 技能              | 底本                                                           | 改造内容                                       |
| --------------- | ------------------------------------------------------------ | ------------------------------------------ |
| spring-security | ECC springboot-security + claudemarketplace spring-framework | 合成认证授权 + FilterChain + JWT/OAuth2，过 Gate 4 |
| java-core       | java-expert（Java 17-21）                                      | 补 jspecify、中文化边界、Boot 4 语境示例               |
| maven-gradle    | SivaLabs maven ref + java-expert                             | 补 Gradle/version catalog/BOM               |
| jspecify        | SivaLabs                                                     | 并入 java-core 边界                            |

### 🔴 自造 28 项（按 Blueprint P0→P1→P2）

**P0（9）**：java-concurrency、jvm-engineering、spring-core、database-engineering、postgresql、redis、maven-gradle（已在🟡？不 ——maven-gradle 是🟡）→ P0 自造实际为：java-concurrency、jvm-engineering、spring-core、database-engineering、postgresql、redis、container-engineering、observability（8）

**P1（11）**：mysql、elasticsearch、kafka、rabbitmq、distributed-systems、resilience-engineering、spring-cloud、api-design、performance-engineering、production-debugging、ci-cd、kubernetes（12）

**P2（9）**：spring-ai、rag、vector-database、ai-backend-engineering、ai-observability、spring-batch、spring-integration、spring-graphql、helm、cloud-native（10）

> 注：上表按 41 项口径（9🟢 + 4🟡 + 28🔴）展开；P0/P1/P2 具体技能数以 Blueprint §4 为准，执行时按 "每批 5-8 个" 推进，不因数量对不上而停顿。



***

## 6. 执行阶段

### Phase 0・基线快照



* **动作**：robocopy 备份 `~/.agents/skills` → `Temp\skills-backup-20260929-v2`；复制体检清单快照；记录 77 个技能 hash 基线。

* **验证**：备份目录数与 77 一致；hash 文件可回读。

* **产物**：备份目录 + `skills-hash-baseline.txt`。

### Phase 1・清理与合并



* **动作**：删 `taste-skill-v1`（先核无独有内容）→ 执行 4 组合并：`brand-system`（brand+brand-guidelines+brandkit）、`design-system`（design-system+design+theme-factory）、`design-implementation`（design-transfer/design-from-screenshot/redesign-skill/banner-design/brutalist-skill/minimalist-skill/soft-skill/stitch-skill/output-skill/imagegen-frontend-mobile/imagegen-frontend-web）、`figma`（figma-intake+figma-implement-design）；taste-skill 吸收 gpt-tasteskill。

* **验证**：合并技能 frontmatter 完整、被吸收技能独有内容逐段核对入新技能、无残留目录；旧目录进备份不删除。

* **产物**：Global 74 目录 + 4 个合并新技能。

### Phase 2・开源入库



* **动作**：装 SivaLabs 5 技能（spring-boot/modulith-verifier/java-code-review/jspecify/spring-modulith）→ 核 developer-kit 许可后装 event-driven → shallow clone ECC 抽 springboot-security/tdd/verification 后删克隆 → 改造 4 项（spring-security/java-core/maven-gradle/jspecify）。

* **验证**：每个技能过 Gate 1-2；溯源 YAML 全部写入 SOURCES.md；ECC 抽取目录无 .git 残留。

* **产物**：Global +13（9 装 + 4 改造落地）+ SOURCES.md。

### Phase 3・自造 28 项（三批）



* **动作**：按 P0（java-concurrency/jvm-engineering/spring-core/database-engineering/postgresql/redis/container-engineering/observability）→ P1（mysql/elasticsearch/kafka/rabbitmq/distributed-systems/resilience-engineering/spring-cloud/api-design/performance-engineering/production-debugging/ci-cd/kubernetes）→ P2（spring-ai/rag/vector-database/ai-backend-engineering/ai-observability/spring-batch/spring-integration/spring-graphql/helm/cloud-native）每批 5-8 个。

* **每技能流程**：按 Blueprint §4 边界写 SKILL.md（定位 / 边界 / 触发 / 反例）→ references/ 按需 → 过 Gate 1-4（含 2-3 条触发 prompt 测试）。

* **素材**：spring.io 官方文档为权威源；SivaLabs/ECC 有可参考段落时吸收并记溯源（modified）。

* **验证**：每批结束跑一次批量 Gate 扫描（frontmatter / 引用路径 / 命名唯一性）。

* **产物**：28 个新技能 + 触发测试记录。

### Phase 4・全量体检与冲突审计



* **动作**：扫描全部 Global 技能（预计～115）——SKILL.md 完整性、命名唯一性、正 / 负触发测试、相邻冲突组（design 系 /spring 系 /testing 系逐组核对 description 边界）。

* **验证**：抽取 10 条典型请求（"写个 Spring REST 接口"、"N+1 怎么修"、"配 JWT"、"Docker 镜像太大"、"做 RAG"…）人工路由到正确技能，零错配。

* **产物**：更新版体检清单（115 项全量归属表 + 冲突审计结论）。

### Phase 5・收口



* **动作**：记 ADR-008（Skill OS 架构：Global 115 + Project 66 分工、开源溯源规范、验收 Gate）→ 更新 AGENTS.md 技能引用（db-migration 重写后改 Flyway/Liquibase 描述、frontend-design 引用不变）→ 交付 Blueprint 系列 4 文档终版。

* **验证**：ADR-008 编号接续 ADR-007；AGENTS.md 引用技能全部存在。

* **产物**：CONTEXT.md 更新、AGENTS.md 更新、最终交付。



***

## 7. 风险与对策



| 风险                                           | 对策                                             |
| -------------------------------------------- | ---------------------------------------------- |
| developer-kit /java-expert 许可核验失败            | 规则 1：不装 → 转自造                                  |
| 开源技能与现有 design/spring 技能触发重叠                 | 规则 3：先合并边界（Gate 3 冲突测试）                        |
| 自造 28 项体量大、质量参差                              | 按 P0→P1→P2 分批 + 每批 Gate 扫描，P0 未过 Gate 不进 P1    |
| 改名（spring-boot-skill→spring-boot）失溯源         | SOURCES.md 强制记录原名与仓库（§3 规范）                    |
| tea 项目 db-migration（Alembic）与全局重写版（Flyway）混淆 | 项目版不动；全局版 description 明确 "Flyway/Liquibase" 触发 |

## 8. 里程碑



| M  | 内容         | 完成标志                     |
| -- | ---------- | ------------------------ |
| M1 | Phase 0-1  | 备份 + 清理合并完成，Global 74    |
| M2 | Phase 2    | 开源 13 项入库，SOURCES.md 就绪  |
| M3 | Phase 3-P0 | P0 8 项自造过 Gate           |
| M4 | Phase 3-P1 | P1 12 项自造过 Gate          |
| M5 | Phase 3-P2 | P2 10 项自造过 Gate          |
| M6 | Phase 4-5  | 体检 115 全绿 + ADR-008 + 交付 |

**首个执行动作**：Phase 0（备份 + hash 基线）—— 随时可启动，无需再确认。