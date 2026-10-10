# trouble-shooting-skill 总览（故障排查，6 个）

> 路由表：线上/本地异常排查。不知道哪类问题 → 00-bug-diagnose；定位后按现象命中 01-05。

| 现象 | 技能 | 定位 |
|---|---|---|
| **不知道哪类问题 / 难复现 / flake / regression** | **00-bug-diagnose** | 6 阶段：建 tight feedback loop → minimize → 3-5 可证伪假设 → 插桩 → 修+回归 → 清理 |
| 接口慢 / 数据库告警 | 01-slow-sql | 慢查询 → EXPLAIN → 索引/N+1/全表 |
| OOM / 内存告警 | 02-oom | 堆转储 → 大对象/泄漏/无界集合 |
| CPU 高 / 卡顿 | 03-cpu | jstack → 热点/GC/死循环/锁竞争 |
| AI 异常 / 502 | 04-ai-exception | LLM 超时/限流/Schema 失败 → 降级链验证（tea 特有） |
| AI 回答不相关 | 05-rag-quality | 检索命中率/切片/阈值 → 来源追溯（tea 特有） |

## 调用规则

- **00 是总入口**：任何 bug 在 theorize 前先过 00-bug-diagnose Phase 1（建一条能稳定变红的命令）；定位到领域再走 01-05。
- **修复后回归**：定位根因（非症状）→ 修复 → 相关测试/压测回归 → 记录。
- **修完走 retro**：这次什么环境问题让 debug 难？该加什么自动化检查？
- **红线一致**：引用编码规范红线（#8 线程池、#10 降级链、文化纪律）。
