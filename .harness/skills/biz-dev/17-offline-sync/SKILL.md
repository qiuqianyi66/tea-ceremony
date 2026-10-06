---
name: offline-sync
description: 离线优先同步——IndexedDB ↔ 后端对账、client_id 幂等、sync_status 流转（pending/synced/failed），tea 承重墙配套。tea 专属 17。
---

# Offline Sync

## 触发
- 离线优先数据（品鉴记录/茶园种植）；同步逻辑改动。

## 工作流
1. 写入：先写 IndexedDB（sync_status=pending）→ 乐观展示 → 异步同步。
2. 幂等：client_id 唯一键（user_id + client_id），重复提交返回同一条。
3. 状态流转：pending → synced / failed；failed 重试有界（指数退避）。
4. 对账：网络恢复批量同步；冲突策略（服务端为准 + 客户端提示）。
5. 写入前 `toRaw` 去代理（防 DataCloneError）。

## 红线
- 幂等写接口（#5）；同步字段改动考虑流转（AGENTS.md §3）。

## 自检
- [ ] client_id 幂等就位
- [ ] sync_status 流转完整
- [ ] 重试有界 + 冲突策略
- [ ] toRaw 去代理
