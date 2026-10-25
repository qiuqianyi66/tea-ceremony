---
name: security-harness-spec
description: tea 安全 Harness 工程规范——「怎么安全地工程化」的实施规范：威胁模型 / 控制矩阵（全部附 file:line 实测证据）/ 新功能安全 checklist / 缺口与反转条件。与编码规范 §8/§9 红线（禁止什么）配套，不重复红线正文。新端点、新公开面、新 AI 能力、新依赖、新 nginx location 编码前必过 §4。
last_updated: 2026-10-22
status: active
owner: yanha
---

# 安全 Harness 工程规范（tea）

> 定位：**「禁止什么」在 `.harness/rules/编码规范.md` §8/§9（R9/R10），本文管「怎么安全地工程化」**——威胁模型、控制矩阵、新功能 checklist、缺口预案。前端代码级样例见 `docs/frontend-engineering-spec.md` §一；本文不重复其内容。
> 覆盖两层：**产品系统安全**（tea 应用自身）+ **Harness 自身安全**（AI 协作治理层）。
> 证据纪律：所有控制项附 `文件:行号` 实测证据（2026-10-22 复核）；缺口项只写「未覆盖 + 反转条件」，不伪装成已防护。

## 0. 一分钟结论

1. 认证授权默认拒绝：除显式 permitAll 白名单外，`anyRequest().authenticated()`；无效 JWT 不设认证上下文，受保护接口统一 401 `ApiResponse`（`SecurityConfig.java:69,71-75`）。
2. 付费面全部限流：AI / 文化搜索 / 登录 / 遥测四档滑动窗口，匿名比登录严（`RateLimitFilter.java:131-149`）。
3. 管理端点独立令牌 fail-closed：未配置 `ADMIN_API_TOKEN` → 全部 401；常量时间比较；先解码再匹配（2026-10-19 修掉 `%61dmin` 编码绕过）（`AdminTokenFilter.java:29-33,71-106`）。
4. 浏览器不直连第三方 AI，降级链是承重墙：非 2xx → 规则引擎（`teaAI.ts:18,36-37,51`）。
5. 传输面：TLS 1.2/1.3 + HSTS + CSP + 安全头单一来源片段；`/api/` 安全头交给后端，防 nginx 拼出非法值（`nginx/snippets/security-headers.conf`）。
6. **新功能动手前过 §4 checklist**；改完跑 §6 命令。红线违反 = 禁止提交。

## 1. 威胁模型（本项目真实攻击面）

| # | 威胁 | 入口 | 现有控制 | 残余风险 |
|---|---|---|---|---|
| T1 | 凭证泄露（DashScope key / `ADMIN_API_TOKEN` / JWT） | 日志、提交、前端包 | `.env*` 禁入库（R9）；密钥只走 env；禁入日志（编码规范 §8/§10）；gitleaks 工作区扫描（CI `secret-scan`） | git 历史全量扫描未开（待遗留本地口令轮换后单独做） |
| T2 | AI 成本滥用（匿名白嫖付费模型） | `/api/v1/ai/*`、`/api/v1/culture/**` 公开可调 | 限流四档 + 每会话配额 429（`RateLimitFilter`；`AiCallQuota`） | 限流为进程内单实例（见 §5-G1） |
| T3 | Prompt 注入（RAG 检索内容不可信） | `culture_chunks` 入库内容随检索注入 prompt | 检索结果仅作上下文；librarian 工具路径经 A/B 灰度（默认 control = 直接检索），工具仅 `culture_query` 只读检索（`LibrarianAgent.java:60-77,171-178`）；MCP 工具只读 | 无输入/输出双向内容过滤（§5-G5） |
| T4 | 越权（读写他人私有数据） | 带他人 id 的请求 | 查询条件强制 userId 归属；会话非本人 404（`AiChatSessionRepository.java:9`；`AiChatService.java:45,136`；`TastingRecordRepository.java:10`）；garden 端点无 by-id 越权面（全部 `@AuthenticationPrincipal` 作用域，`GardenController.java:30-52`） | 新增 by-id 端点时靠 §4-8 自觉；无通用机械化扫描 |
| T5 | Web 面（XSS / 点击劫持 / 嗅探 / 资源枚举） | 浏览器 | 0 处 `v-html`/`innerHTML`（2026-10-22 实测 grep 为空）；CSP `object-src 'none'` + `frame-ancestors 'none'`；`.env/.sql/.pem` 等扩展名 404（`app-locations.conf:49-53`） | CSP `style-src 'unsafe-inline'`（§5-G2） |
| T6 | 供应链（依赖漏洞） | npm / Maven / pip | CI 三门 + Dependabot 四生态（npm/maven/pip/github-actions）：npm audit（high/critical 阻断）、ruff+bandit、pip-audit（有据放行，§5-G4）；dependabot.yml 已补 maven（2026-10-22，此前只覆盖 npm/pip/actions） | Maven 无独立 SCA 深度扫描（依赖 dependabot 版本更新） |
| T7 | 运维面（端口 / 管理端点 / 探针） | 宿主机与云网络 | backend 只绑 `127.0.0.1:18080`（`docker-compose.yml:46-52`）；nginx 只放行 `= /actuator/health`（`app-locations.conf:39`）；`/mcp` 对公网 404（`app-locations.conf:82-92`） | `/actuator/prometheus` 公开可达（§5-G3） |
| T8 | 隐私（遥测上报） | `POST /api/v1/telemetry/batch` 匿名可写 | ADR-022：只上报结构数据、随机 UUID、不落 IP/UA、用户可关、限流 30/min、幂等去重（`ADR-022.md` Decision 1-7） | 指纹一致性依赖前后端两份实现（R4 待决） |

## 2. 控制矩阵（产品系统）

> 每条 = 控制 → 实现 → 实测证据 → 验证方式。改这些文件前先读对应证据行。

### 2.1 认证与授权

| 控制 | 实现 | 证据 | 验证 |
|---|---|---|---|
| 默认拒绝 | `anyRequest().authenticated()` 收尾；白名单显式列举 | `SecurityConfig.java:59-69` | ArchUnit + 集成测试 |
| 无状态 JWT | STATELESS + Bearer；无效 token 静默不设上下文，由 Security 返 401 | `SecurityConfig.java:43-44`；`JwtAuthenticationFilter.java:37-45` | 单测 + 502 契约测试 |
| 密码策略 | BCrypt；8-72 位；弱密码黑名单；登录失败统一文案（防账号枚举） | `SecurityConfig.java:36-38`；`RegisterRequest.java:16-18`；`AuthService.java:21-63` | 单测 |
| 管理端点 | 仅 `X-Admin-Token`；fail-closed；常量时间比较；先解码再 AntPath 匹配 | `AdminTokenFilter.java:29-33,71-106` | 绕过回归单测（`%61dmin`） |
| 过滤器顺序 | rateLimit → adminToken → jwt（注册序 = 执行序） | `SecurityConfig.java:76-82` | 集成测试 |
| CSRF | disable——依据：无 cookie、Bearer 头、无会话（非遗漏） | `SecurityConfig.java:43` | 评审确认 |

### 2.2 AI 面（茶灵）

| 控制 | 实现 | 证据 | 验证 |
|---|---|---|---|
| 代理强制 | 浏览器只调 `/api/v1/ai/*`，禁直连第三方（R10） | `teaAI.ts:18`；编码规范 §9 | audit-redlines R10 |
| 降级承重墙 | 非 2xx / 超时 / 非 JSON → 规则引擎；禁删禁削弱 | `teaAI.ts:36-37,51`；前端单测 | `npm run test` |
| RAG 尽力而为 | 检索失败/超时降级为空上下文，不阻断回答 | `teaAI.ts:23` | 单测 |
| 配额 | 每 sessionId 计数，超限 429 `QuotaExceededException`（与 502 语义分离） | `AiCallQuota`；`AiChatDeps.java:51` | 单测 |
| 熔断分桶 | 按 lane（chat/librarian/advisor/taster/brewer/mentor/judge）隔离，单专家抖动不熔断全场 | `AiCallExecutor.java:24-26`；`BaseExpertAgent.java:40,92` | 单测 |
| 超时与重试 | 硬超时 + 指数退避（带抖动）统一在执行器，专家不各自复制 | `AiCallExecutor.java:24`；`BaseExpertAgent.java:82` | 单测 |
| 专家安全边界 | 功效/健康类提问的产品规则写进 prompt（茶非药物、需就医建议） | `MentorAgent.java:44` | 评测 veto 考点 |
| Prompt 版本化 | `agent_prompts` draft/active，可灰度可回滚 | `AgentPrompt.java:16-22`；`BaseExpertAgent.java:22` | 迁移 + 单测 |
| 灰度安全默认 | 实验不存在/未 running/占比 0 → control，不抛异常 | `ExperimentService.java:39,81,136` | 单测 |

### 2.3 Web 与传输

| 控制 | 实现 | 证据 | 验证 |
|---|---|---|---|
| TLS | 443 + TLSv1.2/1.3 + 现代密码套件；80 只留 ACME + 301 | `nginx.conf:11,30,50-97` | `curl -vI https://<ip>` |
| HSTS | `max-age=31536000`，**不加** includeSubDomains/preload（裸 IP 无子域，写进去无法撤回） | `nginx/snippets/security-headers.conf` 注释 | 响应头检查 |
| CSP | `default-src 'self'`；`object-src 'none'`；`base-uri 'self'`；`frame-ancestors 'none'`；`worker-src 'self'` | 同上 | 浏览器 Console 无违例 |
| 其余安全头 | nosniff / X-Frame-Options DENY / Referrer-Policy / Permissions-Policy | 同上 | 响应头检查 |
| add_header 继承坑 | nginx `add_header` 全有或全无：location 自带一条即丢 server 级全部——凡自带 add_header 的 location 必须显式 include 本片段（线上实测首页曾丢全套头） | `nginx/snippets/security-headers.conf` 注释 | E2E 响应头断言 |
| `/api/` 例外 | 代理路径不经 nginx 加安全头，由后端独占（否则拼成 `DENY,DENY` 非法值被浏览器丢弃） | 同上 | 响应头检查 |
| 资源枚举防护 | `.env/.sql/.conf/.yml/.pem/key/sh/ps1` 扩展名与 dotfiles 一律 404 | `nginx/snippets/app-locations.conf:49-53` | `curl` 实测 |
| XSS | 0 处 `v-html`/`innerHTML`（2026-10-22 实测） | `grep -rn "v-html\|innerHTML" src/` 为空 | CI + 评审 |
| SPA 深链 | 路由白名单 + 末尾 fallback，未知路径不泄露目录结构 | `nginx/snippets/app-locations.conf:101-115` | E2E |

### 2.4 供应链

| 控制 | 实现 | 证据 | 验证 |
|---|---|---|---|
| npm | `npm audit` high/critical 阻断 | `.github/workflows/ci.yml:67-80` | CI `dependency-audit` job |
| Python 旧栈 | ruff + bandit 阻断 | `ci.yml:178-198` | CI `backend-lint` job |
| Python 漏洞 | pip-audit **非阻断**——有据放行：pyasn1/ecdsa 仅 RS256/ES256 路径可达，旧栈只用 HS256 且仅维护 | `ci.yml:86-94`；`PLAN-open-items-2026-10-17.md` A6 | 人工复核记录 |
| 自动升级 | Dependabot 四生态（npm / maven / pip / github-actions）；实战含「升级→发现破坏→回退」闭环（PR #137/#138） | `.github/dependabot.yml` | PR 评审 |
| 密钥扫描 | gitleaks 扫工作区（CI `secret-scan` job，14 job 之一） | `.github/workflows/ci.yml` secret-scan；历史全量扫描待遗留口令轮换后单独开 | CI |

### 2.5 运维与部署

| 控制 | 实现 | 证据 | 验证 |
|---|---|---|---|
| 后端不裸曝 | compose 只绑 `127.0.0.1:18080:8080`；公网入口只有 nginx | `docker-compose.yml:46-52` | `ss -lntp` / compose ps |
| 探针面 | nginx 只放行 `= /actuator/health`；其余 `/actuator/*` 404 | `app-locations.conf:39`；`SecurityConfig.java:56-58` | `curl` 实测 |
| 证书 | Let's Encrypt IP 证书（shortlived，6.7 天）+ cron 每 2 天续期 + 强制续期已实测 | `docs/plans/PLAN-ip-cert-2026-10-18.md` §7 | 外网 https 200 |
| 回滚 | 容器级镜像快照 + 健康门禁脚本 | `scripts/rollback.ps1` | 演练记录 |

## 3. Harness 自身安全纪律（AI 协作治理层）

> 这一层防的不是黑客，是 **Agent 失控**：误改、越权外发、秘密外泄、不可逆操作。规则出处 AGENTS.md §0/§5 与 SOUL.md boundaries。

1. **外部动作先确认**：推送、开 PR、发邮件、发公开内容前必须经用户；内部只读动作（读文件、跑测试、扫描）直接做。
2. **最小改动**：每一行改动可追溯到用户请求；禁顺手重构/格式化/清理（AGENTS.md §5）。
3. **秘密禁入协作面**：`.env*`/`*.pem`/密钥禁入库、禁进 agent 上下文、禁入日志（R9）。
4. **不可逆操作走重流程**：数据模型 = L3（ADR + Flyway 成对迁移 + 往返测试）；main 走 PR-only + 分支保护 13 context；禁 bypass 直推。
5. **子代理权限分级**：探索用只读代理；写操作限执行代理；结论以实测为准，禁转抄「文档写了」当实现（AGENTS.md §0.6）。
6. **审计机械化**：`verify-harness` / `audit-redlines` / `audit-wiki-drift` / `audit-context-budget` 四件套挂 CI；规则漂移 = 门禁红灯，不靠人记。
7. **变更可追溯**：`.harness/changes/{feat}/` 三件套与 git 分支同名；分支合并即闭合。
8. **交付前自检五类**（AGENTS.md §0.8）：伪阻断提问 / 半途交付 / 声明替代实测 / 验证双向可靠 / 禁埋语言后门。

## 4. 新功能安全 Checklist（编码前过，10 项）

1. 新端点默认 `authenticated()`；确需公开 → 同时在 `RateLimitFilter` 加档位，并在代码注释写明理由。
2. 新管理面挂 `X-Admin-Token`（fail-closed），不挂用户 JWT；路径模式与 `SecurityConfig` permitAll 逐字一致。
3. 新密钥只走环境变量（`.env.example` 登记），禁写进 yml/前端包/日志/迁移脚本。
4. 新 AI 能力保留降级链（R10）；新公开 AI 面补限流档与配额口径。
5. 新表/新迁移 = L3：ADR + `db-migrations.sql`/`rollback.sql` 成对 + upgrade/downgrade 往返测试。
6. 新依赖先查 `package.json`/`pom.xml` 禁重复引入；CI audit 三门全绿。
7. 新 nginx location 若自带 `add_header` → 必须 include `security-headers.conf`。
8. 用户私有数据查询带 userId 归属条件（禁只按资源 id 查）。
9. RAG 检索内容与用户输入视为不可信：不进工具调用参数、不回显系统提示、不过滤即输出需评审。
10. 日志/遥测新增字段过隐私三问：含用户内容？可关联身份？用户可关？（ADR-022 口径）

## 5. 缺口与预案（未覆盖项，附反转条件）

| # | 缺口 | 现状 | 反转条件 |
|---|---|---|---|
| G1 | 限流为进程内单实例 | 单容器部署够用（ADR-021 决策暂不引入 Redis） | 多实例水平扩展前必须换 Redis 计票 |
| G2 | CSP `style-src 'unsafe-inline'` | Tailwind 运行时样式与内联 style 需要 | nonce/hash 化改造可收紧时 |
| G3 | `/actuator/prometheus` 在 Security 层 permitAll（ADR-025） | 当前公网**不可达**：nginx 无该 location（落 `location /` → `try_files $uri =404`），backend 只绑 loopback。风险在「未来新增 proxy location 时忘记补认证」 | 抓取端走内网；若要经 nginx 暴露，先加抓取令牌或网络 ACL |
| G4 | pip-audit 非阻断 | 旧栈漏洞不可达（A6 结案，`ci.yml:88-90` 注释） | 迁 PyJWT，或旧 FastAPI 整段退役 |
| G5 | 无输入/输出双向内容过滤；无 agent 内部 span 追踪 | A/B 灰度已立（ADR-024 + librarian tool-calling 实验 + 守门回滚）；内容过滤与 span 仍缺（生产就绪审计 #14/#9/#10 口径已部分闭合，见 `docs/plans/audit-ai-production-readiness-2026-10-18.md` §五） | 内容安全拦截器立项；span 需 OpenTelemetry 或自建 span 表 |
| G6 | 旧栈双门禁（pytest + bandit + pip-audit 与 Maven 并存） | 后端重写中（AGENTS.md §7） | 重写完成、`backend/app` 退役后删旧门禁 |
| G7 | JWT 无注销/黑名单 | 无状态设计，类注释明示「账号禁用类需求未来切片」 | 出现注销/禁用需求时引入状态查询或黑名单 |

## 6. 验证入口（命令）

```bash
node scripts/verify-harness.cjs       # 治理一致性（ADR/CI job/技能数/路径），期望 ERRORS: []
node scripts/audit-redlines.cjs       # 红线 R1-R15 机械化审计，期望 ERRORS: []
node scripts/audit-wiki-drift.cjs     # wiki 契约双向核对，期望 ERRORS: []
node scripts/audit-context-budget.cjs # 常驻层 token 预算，期望 ERRORS: []
npm run quality                       # 提交前门禁（type-check + test + lint + build）
cd backend && mvn -q test             # 后端全量（含 ArchUnit 分层与红线规则）
```

CI 安全相关 job（共 14 个）：`dependency-audit`（npm audit）、`secret-scan`（gitleaks 工作区）、`backend-lint`（ruff + bandit）、`harness-consistency`（docs 漂移）、`migration-test`（迁移往返）。

## 7. 变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-22 | 首版：威胁模型 T1-T8、控制矩阵五域（证据 2026-10-22 实测复核）、Harness 纪律 8 条、新功能 checklist 10 项、缺口 G1-G7 |
| 2026-10-22（晚） | ①T4 修正：越权已有机械化测试（AI 会话 / 品鉴记录），garden 无 by-id 越权面；②T6/T1：补 gitleaks 工作区扫描 + dependabot maven 生态；③CI job 数 13→14（新增 `secret-scan`，分支保护 context 已同步）；④nginx 显式 404 其余 `/actuator/*`（G3 的隐式关闭改显式决策） |
