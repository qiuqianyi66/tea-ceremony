# Plan · Global Skills V2 开源优先实施计划

> 意图：Blueprint（v1）已定架构；本计划解决"新增 41 个技能从哪来"——**优先直接安装已验证的开源技能，其次改造，最后才自造**；同时引入开源"技能创作工程规范"作为新建技能的质检线。
> 依据：2026-09-29 实搜并精读的开源仓库（见下）；所有来源已核对 MIT 许可与内容质量。

## Scope

- **In**：开源 Spring/Java 技能选型 · 与 Blueprint 41 个新增项的映射 · 工程规范来源 · 分阶段执行清单
- **Out**：不执行任何安装/删除（等你拍板后另起执行轮）；不做 GitHub 全量枚举（只收录已核实可用者）

---

## 一、已验证的开源来源（质量已抽查）

### A. Spring 专项技能（直接可用）

| 来源仓库 | 许可 | 技能 | 对应 Blueprint 新增项 | 备注 |
|---|---|---|---|---|
| **sivaprasadreddy/sivalabs-agent-skills**（184★, 社区知名 SivaLabs） | MIT | `spring-boot`（SKILL.md + 15 个 references：Maven 配置/包结构/JPA/Service/MVC REST/Modulith/Thymeleaf/分层测试/ArchUnit/Testcontainers/Compose/Taskfile） | spring-boot、spring-web、spring-data、jpa-hibernate、spring-testing、testcontainers、spring-modulith、maven-gradle（部分） | **首选**，Boot 4.x 最佳实践，测试策略极扎实（真实 DB + Testcontainers，禁 H2） |
| 同上 | MIT | `spring-modulith-verifier` | spring-modulith | 模块化单体验证 |
| 同上 | MIT | `java-code-review` | 01 SOFTWARE ENGINEERING·code-review | Java 代码评审 |
| 同上 | MIT | `jspecify` | java-core（补充） | 可空性规范 |
| **affaan-m/everything-claude-code**（269k★, 巨型 harness） | MIT | `springboot-patterns` / `springboot-security` / `springboot-tdd` / `springboot-verification` + java 技能组 | spring-security、spring-testing、verification | 仅取 skills/ 下 java 相关子集，不整库装 |
| **giuseppe-trisciuoglio/developer-kit**（150+ skills） | 需核 | `spring-boot-event-driven-patterns` / `spring-boot-test-patterns` / CRUD generation | event-driven-architecture、spring-testing | 补充来源，安装前核许可 |
| **claudemarketplaces.com** `personamanagmentlayer/pcl/java-expert` | 需核 | Java 17-21 现代特性 + Spring Boot + Maven/Gradle 示例 | java-core、maven-gradle | 含 virtual threads / structured concurrency |
| **piotrminkowski.com** Claude Code Template | 需核 | `java-architect`（WebFlux/JPA/Spring Security/云原生） | spring-web、performance（补充） | 知名 Spring 博主 |
| **skillmd.ai** `spring-boot-rest-api-standards` | 需核 | REST 规范：DTO/错误处理/分页/安全头/HATEOAS | api-design、spring-web | API 规范骨架 |

### B. 工程规划规则 / 技能创作规范（写新技能时用）

| 来源 | 规范内容 | 用途 |
|---|---|---|
| **addyosmani/agent-skills** `docs/skill-anatomy.md` | 技能命名/目录/结构规范（lowercase-hyphen、SKILL.md 大写、references 根目录共享） | 新建技能的硬规范 |
| **allonsy-studio/agent-skills** `docs/skill-architecture.md` | 技能架构：SKILL.md = frontmatter + body + 可选脚本/资产 | 理解跨工具标准 |
| **aiskillstore/marketplace** `skill-writer` | description ≤1024 字符、写"做什么+何时用"、触发词具体化 | frontmatter 质检 |
| **Azure git-ape** `docs/authoring/framework` | 从真实任务提炼技能、禁止泛化空话（"handle errors appropriately"） | 自造技能方法论 |
| **GitHub awesome-copilot** `creating-effective-skills` | 一技能一目的、为发现而写、捆绑模板/参考减少幻觉、通用化 | 自造技能验收清单 |
| **openai/skills** `.system/skill-creator`（已装） | 官方 skill-creator | 触发测试与评估 |

---

## 二、映射决策：Blueprint 新增 41 项 → 来源

| Blueprint 新增项 | 来源决策 | 说明 |
|---|---|---|
| spring-boot | 🟢 装开源（SivaLabs） | 直接装 `sivalabs-agent-skills --skill spring-boot`，改名为全局 `spring-boot` |
| spring-web | 🟢 装开源（SivaLabs 的 MVC REST reference）+ skillmd 规范 | 吸收后微调 |
| spring-data / jpa-hibernate | 🟢 装开源（SivaLabs references） | 其 JPA/Service/Repository 体系即核心边界 |
| spring-testing / testcontainers | 🟢 装开源（SivaLabs 测试策略）+ ECC springboot-tdd | 分层测试表直接可用 |
| spring-modulith | 🟢 装开源（SivaLabs modulith + verifier） | 连验证器一起 |
| spring-security | 🟡 开源改造（ECC springboot-security + mindrally spring-framework 合并） | 无单一完美源，需合成 |
| java-core | 🟡 开源改造（java-expert 为底 + jspecify 补充） | 现代特性覆盖好，需中文化边界 |
| maven-gradle | 🟡 开源改造（SivaLabs maven ref + java-expert 示例） | 补 Gradle 部分 |
| event-driven-architecture | 🟢 装开源（developer-kit spring-boot-event-driven-patterns） | 直接装 |
| java-concurrency / jvm-engineering / java-performance | 🔴 自造 | 无成熟开源专项；按 Blueprint 边界写，用工程规范质检 |
| database-engineering / postgresql / mysql / redis / elasticsearch | 🔴 自造 | 通用 DB 技能少且质量参差，自造更可控 |
| kafka / rabbitmq | 🔴 自造 | 现有开源多为教程式，缺工程判断；自造 |
| distributed-systems / resilience-engineering / spring-cloud / api-design | 🔴 自造 | 架构判断层，自造 |
| performance-engineering / production-debugging / observability | 🔴 自造 | 自造（ECC 有部分可参考） |
| ci-cd / kubernetes / container-engineering | 🔴 自造 | 通用 Ops，自造 |
| spring-ai / rag / vector-database / ai-backend-engineering / ai-observability | 🔴 自造 | 官方文档为权威源，自造（可用 spring.io 博客做素材） |
| java-core（吸收后） | 🟡 开源改造 | 见上 |
| db-migration（重写） | 🔴 自造 | Flyway/Liquibase 专项 |

**统计**：🟢 直接装 9 项 · 🟡 开源改造 4 项 · 🔴 自造 28 项。新增 41 项中约 1/3 有开源可借力，其余按规范自造。

---

## 三、Action items（按序执行）

- [ ] **Backup**：执行前 `robocopy` 备份全局技能库到 Temp\skills-backup-20260929-v2（含清单快照）
- [ ] **Install**：`npx skills add sivaprasadreddy/sivalabs-agent-skills --skill spring-boot`（及 modulith-verifier、java-code-review、jspecify）到全局 `~/.agents/skills`
- [ ] **Vendor**：克隆 affaan-m/everything-claude-code（shallow），抽取 springboot-security/tdd/verification 三个技能目录入库后删克隆
- [ ] **Verify-source**：逐一核 developer-kit / java-expert / piotrminkowski / skillmd 的许可与更新日期，合格才装
- [ ] **Map**：将已装开源技能改名对齐 Blueprint 命名（spring-boot-skill → spring-boot 等），写引用关系
- [ ] **Author**：按工程规范自造 28 项（java 3 → spring 4 补缺 → data 6 → 分布式 3 → ops 5 → AI 5 → db-migration 重写），每项过 addyosmani anatomy + aiskillstore frontmatter 两条质检
- [ ] **Trigger-test**：用 skill-creator 流程对每个新技能跑 2-3 条触发 prompt，调 description
- [ ] **Consolidate**：全量体检（SKILL.md 完整性 + 命名唯一性 + 触发无重叠），更新技能库体检清单 + 记 ADR-008
- [ ] **Ship**：阶段 1 清理（taste-skill-v1 删除、4 组合并）与安装/自造分轮落地，每轮验证后交付

---

## 四、Open questions

1. 开源技能装进全局后**改名**（spring-boot-skill→spring-boot）会失去上游溯源——接受改名，还是保留原名 + 别名映射？
2. developer-kit / java-expert 等来源许可需逐一核，**未核清前不装**——同意？
3. ECC 仓库 269k★ 但体积巨大，只抽 3 个技能目录入库——同意？
4. 自造 28 项按 Blueprint 的 P0→P1→P2 分批，还是先造 P0 17 项验证质量后再继续？
