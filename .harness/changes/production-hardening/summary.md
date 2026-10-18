# production-hardening

> 分支：`feature/production-hardening`　依据：PR #108 合并后的遗留清单
> 目标：把「审计发现 → 修好了」变成「线上真的能跑、出事真的会被叫醒」

## 范围（六项）

| # | 项 | 交付 |
|---|---|---|
| 1 | 合并 PR #108 | 已 squash 合并（`5ccab4a`），三方夹带提交已 rebase 剥离 |
| 2 | HTTPS / 443 就绪 | `nginx.conf` 真实 443 server + `app-locations.conf` 单一 location 集合（80 只做 ACME + 301）+ compose 443/证书挂载 + 签发与自签脚本 |
| 3 | 指标可见与告警 | `micrometer-registry-prometheus` + `/actuator/prometheus` + 13 条告警规则 + 10 面板看板 + 可选 overlay |
| 4 | AI 回答质量指标化 | `quality_layer`（V10）+ 规则判官 + LLM 判官 + `GET /api/v1/ai/metrics/quality` |
| 5 | Tool Calling 进 chat | `CultureQueryTools` + `LibrarianAgent` 双轨 + 实验键 `ai.librarian.tool-calling` |
| 6 | 技术债 | 熔断分类修正、死配置清除、PWA 预缓存、视觉回归不再无条件跳过 |

## 验收判据

1. `nginx -t` 在生产镜像里 `syntax is ok`（无 warning），443 真能握手、80 真跳转、ACME 不被跳走。
   证书用临时自签：TLS 层等价，但真实 Let's Encrypt 签发链路未验证。
2. `/actuator/prometheus` 公网 404，指标只能从宿主机回环取。
3. 告警规则里引用的每个指标都能在 Java 代码里找到埋点（机械化校验，含负向验证）。
4. 质量分零样本返回 null 而非 0；判官不可用时整批降级且不抛异常。
5. 未配置实验时 `LibrarianAgent` 行为与改造前逐字一致。
6. 业务错误不计入熔断，上游错误计入——用同一阈值 1 的对照组双向证明。

## 实测证据

```
mvn clean test（Docker 已启用）        → Tests run: 487, Failures: 0, Errors: 0, Skipped: 0 / BUILD SUCCESS
npm run quality                        → exit 0
nginx -t（nginx/Dockerfile 构建的生产镜像 + 临时自签证书）→ syntax is ok（无 warn）
curl -k https://localhost:18443/       → 200，6 个安全头 + HSTS
curl http://localhost:18081/           → 301 → https://localhost/
curl .../.well-known/acme-challenge/x  → 404（不被 301 跳走，续期可用）
curl -k .../actuator/prometheus        → 404（公网不可达）
openssl s_client -alpn h2              → ALPN protocol: h2
node scripts/verify-alert-rules.cjs    → 埋点 12 / 规则 13 / 面板 10，ERRORS: []
  └ 负向：把 tea_ai_fallback_hit_total 改成 typo → 立即报「未知指标」
```

## 回滚

- 代码：`git revert` 对应提交；`deploy/` 与 `scripts/https-*` 是新增文件，删除即回滚。
- 数据：`ALTER TABLE ai_eval_traces DROP COLUMN quality_layer;`（并删 `idx_eval_traces_unjudged`）。
- 部署：`docker compose` 去掉 443 映射与证书挂载即回到纯 HTTP（客户端不受影响，因为 80 仍在）。

## 影响面

- `AiCallPolicy` 构造参数 8 → 7（删掉从未生效的 `retryOnStatusCodes`），仅测试侧随之调整。
- `AiEvalTrace` 加一个字段；`ddl-auto=validate` 要求 V10 先执行（Flyway 自动）。
- `backend` 端口绑定改为 `127.0.0.1:18080`：宿主机本机仍可 curl，公网不再直达 8080。
