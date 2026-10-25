---
last_updated: 2026-10-25
status: active
owner: yanha
---

# backend-dedup-2026-10-25 评审记录

## Findings

- 🔴 1 条（已修复）：**Spring 上下文缓存键塌缩**——提取后 12 个子类的 @DynamicPropertySource 方法集相同，同配置测试类（A/B/E 三组共 9 类）复用第一个类的缓存上下文，而共享容器对象每类 stop/重启到新随机端口 → 复用方连接池指向已死容器，表现为偶发 flaky。修复：基类 `@DirtiesContext(AFTER_CLASS)`（@Inherited），复原提取前"每类一个上下文一个容器"语义。来源：子代理独立审查（Explore，两轮），机制经 Spring Framework 6.2.x 源码级核验（DynamicPropertiesContextCustomizer equals 基于 Method 集；@DirtiesContext @Inherited + 默认监听器 + 父类注解查找）。
- 🟡 2 条（已修复）：基类 javadoc 两处措辞——①"所有子类都只剩基类 datasource"对 AdminCultureBackfill 变体不成立（它多一个 adminToken 方法、缓存键本就唯一）；②"禁 surefire 并行"范围过宽（真危险是同 JVM 并行，forkCount 多 JVM 分叉安全）。均已按复核意见改写。
- 🟢 4 条：
  - 提取等价性核验通过：13 类注解（@SpringBootTest properties / @Testcontainers(disabledWithoutDocker) / @DataJpaTest）零变化；Pagination 消息逐字一致、MAX_SIZE 无残留、TeaService 的 BadRequestException import 删除后确无引用（TastingRecordService 保留是正确的——还有两处使用）。
  - 验证链完整：mvn 全量 **531 tests / 0 Failures / 0 Errors / 0 Skipped**（真实退出码 0；含 4 个此前因 Docker 检测失败被跳过的类本轮真跑）；既有 TastingRecordServiceTest / TeaServiceTest 的分页消息断言未改动且通过（锁死消息等价）。
  - 首轮全量失败（9 Errors）根因是 **Docker 引擎会话中途死亡**（341 系统管道 0 个 docker_*），与迁移无关；引擎重启后全绿。已写入 lessons.md（含"管道吞退出码一天两踩"教训）。
  - 刻意不并入 ErrorFingerprintService 的钳制式分页（容错语义 vs 抛错语义，行为差异是特性）。

## Verdict

🔴 0 🟡 0

通过。等 PR CI 全绿后由用户验收合并（用户批示 2026-10-26 验收）。
