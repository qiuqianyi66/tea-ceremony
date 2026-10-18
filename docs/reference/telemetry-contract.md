---
last_updated: 2026-10-17
status: active
owner: yanha
---

# 遥测契约 v1（前后端唯一真源）

> 依据 ADR-022。前端实现与后端实现都必须严格按本文件，不得各自扩展字段。
> 改本文件 = 改契约，前后端必须同 PR 同步。

## 1. 端点

| 方法 | 路径 | 鉴权 | 说明 |
|---|---|---|---|
| POST | `/api/v1/telemetry/batch` | 匿名（permitAll + 限流） | 批量上报，`≤50` 条/请求 |
| GET | `/api/v1/telemetry/slo` | 需 JWT | SLO 当前达成率与健康分 |
| GET | `/api/v1/telemetry/fingerprints` | 需 JWT | 错误指纹列表（含 `review_status` 过滤） |
| PATCH | `/api/v1/telemetry/fingerprints/{id}/review` | 需 JWT | Human-in-the-Loop 审批 |

所有响应统一 `ApiResponse<T>`：`{ code, message, data }`。

## 2. 上报请求体

```jsonc
{
  "clientId":   "8f14e45f-ea9c-4c1b-9c1a-1a2b3c4d5e6f",  // 设备级匿名 UUID，用户可重置
  "sessionId":  "3c59dc04-8e5c-4a1e-b7f0-0f6a1c2d3e4f",  // 会话级 UUID
  "appVersion": "2.0.0",
  "sentAt":     "2026-10-17T06:00:00.000Z",
  "events": [
    {
      "clientEventId": "a1b2c3d4-0000-4000-8000-000000000001",  // 幂等键，UUID
      "type": "error",                 // error | vital
      "occurredAt": "2026-10-17T05:59:59.000Z",
      "route": "/brew",                // 路由 path，≤128
      "payload": { }                   // 见 §3
    }
  ]
}
```

## 3. payload 两种形态

### 3.1 `type = "error"`

```jsonc
{
  "kind": "error",                   // error | unhandledrejection | resource
  "message": "TypeError: Cannot read property 'x' of undefined",  // 已脱敏，≤500
  "source": "/assets/index-bsowGVBP.js",  // 只留 pathname，≤256
  "lineno": 1234,                    // 可空
  "colno": 56,                       // 可空
  "stack": "at foo (/assets/a.js:1:2)\n...",  // 已脱敏，≤4000
  "fingerprint": "1a2b3c4d5e6f7a8b"  // 16 位小写 hex，见 §5
}
```

### 3.2 `type = "vital"`

```jsonc
{
  "name": "LCP",                     // LCP | INP | CLS | FCP | TTFB
  "value": 2345.678,                 // 保留 3 位
  "rating": "good",                  // good | needs-improvement | poor（web-vitals 原值）
  "navigationType": "navigate"
}
```

## 4. 上报响应

```jsonc
{ "code": "OK", "message": "success",
  "data": { "accepted": 3, "duplicated": 1, "rejected": 0 } }
```

- `accepted`：新入库条数
- `duplicated`：`client_event_id` 已存在，忽略
- `rejected`：校验失败（类型非法、超长、字段缺失）

**永不因单条非法而整体 400**：逐条校验，合法入库、非法计入 `rejected`。整个请求只有在 `events` 非法（非数组 / >50 / 缺 `clientId`）时返回 400。

## 5. 错误指纹算法（前后端必须一致）

目的是把同一 bug 的不同实例归并成一条。

```
输入: kind, source(pathname), message, lineno
1. message 归一化:
   - 去首尾空白
   - 替换 URL        /https?:\/\/[^\s)]+/g  → <url>
   - 替换 UUID        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi → <uuid>
   - 替换长 token     /[A-Za-z0-9_-]{24,}/g → <token>
   - 替换引号内字面量 /'[^']*'|"[^"]*"/g → <str>
   - 替换独立数字     /\b\d+\b/g → <n>
   - 截断 300 字符
2. source 取 pathname，去掉 hash 与 query
3. lineno 分桶: bucket = floor(lineno / 10) * 10   （行号漂移 10 行内视为同一处）
4. key = `${kind}|${source}|${bucket}|${normalizedMessage}`
5. fingerprint = FNV-1a 64bit(key) 转 16 位小写 hex
```

**为什么不用 SHA-256**：站点当前跑在 HTTP 上，`crypto.subtle` 不可用（实测 `hasCryptoSubtle: false`）。指纹必须在任何上下文都能算，故用纯 JS FNV-1a。碰撞风险对本用途可接受（16 hex = 64 bit）。

## 6. SLO 目标（前后端共享常量）

| 指标 | 目标（P75） | 单位 | 权重 |
|---|---|---|---|
| LCP | ≤ 2500 | ms | 25 |
| INP | ≤ 200 | ms | 25 |
| CLS | ≤ 0.1 | 无量纲 | 20 |
| FCP | ≤ 1800 | ms | 15 |
| TTFB | ≤ 800 | ms | 15 |

健康分 = Σ(指标权重 × 达成系数)，达成系数：

- 达标：1.0
- 超标 ≤ 50%：`1.0 - (超出比例 / 2)`，下限 0.4（例如 LCP 3750ms，超出 50%，系数 0.75 → 得 18.75）
- 超标 > 50%：0.2
- 无样本：0 分，并在响应里标 `insufficient_data`

健康分范围 0–100，保留 1 位小数。

## 7. 前端传输策略（多级兜底）

按序尝试，任一成功即止：

1. `navigator.sendBeacon(url, blob)` —— 只在 `pagehide` / `visibilitychange→hidden` 冲刷时用
2. `fetch(url, { keepalive: true, method:'POST' })` —— 事件多或 beacon 返回 false 时
3. 普通 `fetch` + `AbortController` 8s 超时
4. 全失败 → 事件留 IndexedDB outbox，按退避表重试

**退避表**（第 n 次失败后等待）：`1s, 5s, 30s, 2min, 10min`，共 5 次，之后标记 `dead` 不再重试（保留在队列里等人工/下次启动再评估）。

**熔断**：连续 3 次传输失败 → 打开熔断 60 s，期间**只入队不发**。60 s 后放行 1 次试探（半开），成功则关闭熔断。

## 8. 采样与限流（前端）

| 事件 | 采样 | 去重窗口 | 队列上限 |
|---|---|---|---|
| vital | 100%（每页每指标 1 条） | — | — |
| error | 100% | 同指纹 5 分钟内只发 1 条（其余累加计数，随下一条带出） | outbox 500 条 |

全局令牌桶：10 次请求 / 分钟，桶容量 10。超限则事件只入队，等下个窗口。

## 9. 后端入库规则

- `client_event_id` 唯一约束，`ON CONFLICT DO NOTHING` 实现幂等。
- 入库前必过 `TelemetrySanitizer`：剥离 URL query、邮箱、JWT 形态串（`eyJ...`）、≥24 位连续 token、纯数字 ID。
- 不存 IP、不存 UA 原文。
- `error` 事件同时 upsert `error_fingerprints`：`occurrences + 1`，更新 `last_seen_at`；首次插入时 `review_status='pending'`（Human-in-the-Loop 待审批）。
- `vital` 事件只落 `telemetry_events`，由定时任务聚合成 `slo_snapshots`。

## 10. 保留策略

| 表 | 保留 | 方式 |
|---|---|---|
| `telemetry_events` | 7 天 | 每日 03:00 删除 `occurred_at < now() - 7 days` |
| `error_fingerprints` | 永久 | 不删，`resolved` 后可归档（本期不实现归档） |
| `slo_snapshots` | 永久 | 每 15 分钟一个窗口，永久保留 |
