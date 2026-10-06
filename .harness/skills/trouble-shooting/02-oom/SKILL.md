---
name: oom
description: OOM 排查——堆转储分析（MAT/JFR），定位大对象/泄漏/无界集合，修复后回归。故障排查 02。
---

# OOM

## 触发
- OOM 报错/内存告警；GC 频繁。

## 工作流
1. 复现：保留现场（-XX:+HeapDumpOnOutOfMemoryError）。
2. 分析：堆转储用 MAT/JFR → 大对象/支配树 → 泄漏点（静态集合？无界缓存？线程池？）。
3. 修复：无界集合改有界（Caffeine/线程池队列）、资源未关闭补 finally、对象过大分页。
4. 验证：压测 + GC 观察（内存曲线稳定）。

## 红线
- 禁 Executors.newFixedThreadPool（#8）；禁无界缓存（编码规范 §12 缓存规范）。

## 自检
- [ ] 泄漏根因定位（非症状）
- [ ] 有界化修复
- [ ] 内存曲线稳定
