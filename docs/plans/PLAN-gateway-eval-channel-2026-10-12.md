---
type: plan
status: active
date: 2026-10-12
related: REQ-ai-eval-v6-2026-10-12.md, ITERATIONS.md
---

# PLAN: yg-gateway 评测通道（解锁 T08/T09 的免费替代模型链路）

## 1. 背景与目标

Phase 3 评测基线 T08（pass³）/ T09（judge 校准）被 OQ-2 阻塞：DashScope 账户欠费，
后端 AI 调用全部 HTTP 400 `Arrearage / overdue-payment`（非代码问题）。

用户拍板两条替代路径：① WorkBuddy 积分免费额度；② 自建 yg-gateway（CodeBuddy 账号池
OpenAI 兼容网关）可分 API key 给 tea 做评测。本方案把 yg-gateway 接入 tea 后端，
用 deepseek-v4.1-flash 跑通评测管道，**只验证管道与判分器，不产出正式基线**。

## 2. 架构

```
评测器 eval-tea-ai.cjs (Node fetch)
  └─ POST /api/v1/ai/chat  (tea-backend:18080, gateway profile 激活)
       └─ spring-ai OpenAiChatModel → yg-gateway-eval (127.0.0.1:7864, passthrough)
            └─ CodeBuddy 账号池 (4 账号, 积分 4109/4109/4105/1232, 最早到期 2026-10-31)
                 └─ cn:deepseek-v4.1-flash (免费档, 白名单裸模型名)
```

- 主网关 7863 保持 prompt.mode=custom（persona.md 会**替换**客户端 system——对评测破坏性），
  评测必须走独立实例 7864（prompt.mode=passthrough，system 原样透传，养号六调度全禁）。
- 网关无 embeddings 端点 → RAG 向量分支自动降级纯 ILIKE（与生产无 key 降级路径一致，可接受）。

## 3. 代码改动清单（未提交，待 PR）

| 文件 | 改动 | 说明 |
|---|---|---|
| `backend/pom.xml` | + spring-ai-starter-model-openai:1.1.2 | OpenAI 兼容接入（与 MCP starter 版本对齐） |
| `backend/src/main/resources/application.yml` | + `spring.autoconfigure.exclude`（openai 的 embedding/audio/image/moderation 五个自动配置）；+ `spring.ai.model.chat: dashscope` | ①openai embedding 与 dashscope 双装配 → @MockBean/ObjectProvider 歧义；②audio/image/moderation 工厂方法无 key 即启动失败（测试环境全炸）；③chat 默认固定 dashscope 消除双 ChatModel 歧义 |
| `backend/src/main/resources/application-gateway.yml`（新增） | gateway profile：`spring.ai.model.chat: openai` + openai base-url/api-key/model | base-url 必须**根地址**（Spring AI 自动拼 /v1/chat/completions，带 /v1 会成 /v1/v1/） |
| `docker-compose.eval.yml`（新增） | backend 环境变量：SPRING_PROFILES_ACTIVE=gateway + AI_GATEWAY_* | host.docker.internal 指向宿主评测网关 |
| `CultureSearchService.java` | `getIfAvailable()` → `getIfUnique()` | 多候选（双 EmbeddingModel）时不抛 NoUniqueBeanDefinition，返回 null 走 no_model 降级；生产单 bean 行为不变 |

## 4. 踩坑记录（复用必读）

1. **base-url 不带 /v1**：Spring AI OpenAiApi 在 base-url 后追加 `/v1/chat/completions`，
   传 `http://host:7864/v1` 会拼成 `/v1/v1/chat/completions` → ConnectException。
2. **openai starter 五大模态自动配置**：embedding（双装配歧义）+ audio/speech/transcription/image/moderation
   （无 key 工厂方法启动失败）。全排除，只留 chat。类名前缀 `org.springframework.ai.model.openai.autoconfigure.`（1.1.2 新包名）。
3. **JWT fail-closed**（PR #62 起）：本地 `mvn test` 必须注入 `JWT_SECRET`（≥32 字节），否则 JwtService 构造抛异常。
4. **评测网关进程会挂（已修）**：根因 = `schedule.balance_refresh_enabled: true`（每 5 分钟余额刷新）
   触发进程无日志退出（两次实测：启动后 ~5 分钟挂）。评测不需要余额刷新 → 置 false。
   重启：`Start-Process D:\yg-gateway-eval\yg-gateway.exe -WorkingDirectory D:\yg-gateway-eval`，
   验证 `http://127.0.0.1:7864/healthz` = 200，并确认存活超过 5 分钟。主网关 7863 与评测实例 7864 独立进程。
5. **config.json 无 BOM**（先前会话）：PowerShell 写 JSON 用 `[IO.File]::WriteAllText` + UTF8Encoding($false)，
   `Set-Content -Encoding UTF8` 带 BOM 使 Go 解析失败。
6. **限流节奏**：后端 AI 限流 10/min/IP，评测 `--delay 7000`（实测 3 条 judge 无 429）；
   `--judge` 时每条另发评委调用，间隔不足会整条 0 分（T08 首跑 50 条全 429 教训）。

## 5. 用法

```powershell
# 1) 确认评测网关活着
Invoke-WebRequest http://127.0.0.1:7864/healthz

# 2) 起评测后端（gateway profile）
$env:AI_GATEWAY_API_KEY = "sk-eval-2c5ea4b879df1630"
docker compose -f docker-compose.yml -f docker-compose.eval.yml up -d --build backend

# 3) 小规模冒烟（先验证链路）
node scripts/eval-tea-ai.cjs --file advisor.yaml --subset 2 --delay 13000

# 4) T08 正式 pass³（全量 50 条 × 3 迭代，约 1 小时）
node scripts/eval-tea-ai.cjs --judge --iterations 3 --delay 7000

# 5) T09 judge 校准
node scripts/calibrate-judge.cjs --judge

# 6) 评测完恢复生产后端
docker compose -f docker-compose.yml up -d backend
```

## 6. 口径与边界（硬约束）

- **本通道结果 ≠ 正式基线**：生产模型是通义千问（DashScope），评测网关跑的是
  deepseek-v4.1-flash（经 CodeBuddy 账号池）。分数只能验证管道通、判分器行为对，
  不能写入简历口径（简历只用 judgeCoverage=1 的 v3 0.81 / v5 0.80 / T10 taster 0.88 mentor 0.81）。
- 正式基线仍需 DashScope 充值（阿里云百炼控制台，¥50 够评测；OQ-2）。
- RAG 向量检索在本通道降级 ILIKE：culture_chunks 回填 pending、无向量命中属预期。
- 评测期间前端（若在用）AI 走网关模型而非生产模型；评测完必须恢复（第 5 步第 6 条）。

## 7. 状态（截至 2026-10-12）

- [x] 评测专用网关实例建成并验证（7864，passthrough，tea-eval key）
- [x] 后端 gateway profile 接入（bean 冲突全解：embedding 排除 + chat 默认 + getIfUnique）
- [x] 小规模链路验证（advisor 3 条 judge on：overall 0.83，judge 覆盖率 1，无 429）
- [x] 全量后端测试通过（含 Testcontainers，无回归）
- [x] 代码改动 PR #64 合入 main（a1ae68b，CI 13/13 全绿）
- [x] 评测网关稳定性修复：**禁用 balance_refresh**（每 5 分钟刷新是两次进程退出元凶，禁用后跨 5 分钟窗口验证存活）
- [ ] T08 pass³ 全量跑（重跑中，约 2-3 小时——deepseek-v4.1-flash 推理慢，实际 ~19s/调用）
- [ ] T09 judge 校准
- [ ] 评测报告 commit + ITERATIONS/TODO-PRIORITY 更新
