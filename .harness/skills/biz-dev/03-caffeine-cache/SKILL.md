---
name: caffeine-cache
description: 本地缓存——Caffeine（容量+过期+统计），键规范 tea:{module}:{biz}:{id}，禁 HashMap 缓存、禁无界。业务专项 03（替代 redis-cache，tea 不引入 Redis）。
---

# Caffeine Cache

## 触发
- 高频读低变数据（文化内容/配置）；redis-cache 被裁后的本地方案。

## 工作流
1. 定义 `Cache<String, T>` Bean（显式 maximumSize + expireAfterWrite + 统计）。
2. 键规范 `tea:{module}:{biz}:{id}`；禁硬编码裸键。
3. 一致性：写库后失效对应缓存（禁只写缓存）。
4. 穿透防护：空值缓存；数据量小用 `allKeys` 预加载（seeds 场景）。

## 红线
- 禁 HashMap 本地缓存；禁无 TTL 无界缓存（编码规范 §12 缓存规范）。

## 自检
- [ ] 容量/过期/统计齐全
- [ ] 键规范统一
- [ ] 写库后缓存失效
- [ ] 无无界缓存
