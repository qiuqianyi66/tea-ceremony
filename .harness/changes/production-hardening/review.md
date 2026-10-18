# production-hardening Review

> 评审对象：PR #108 合并后的六项遗留（HTTPS / 告警 / 质量指标 / Tool Calling / 技术债 / 合并）
> 评审方式：主控逐项复核；凡是"能跑一次"的验证都不采信声明
> 结论：**通过（有条件）**，0 🔴 0 🟡，遗留 5 项已定性

## 一、本轮抓到的自主缺陷（都发生在自己或子代理的产出里）

| # | 缺陷 | 怎么发现的 | 处置 |
|---|---|---|---|
| 1 | `retryOnStatusCodes` 从落地起就没生效 | 逐个检查"未生效配置项"时发现全库只有定义没有读者 | 删除。可配但没人读的项比没有更糟：它让人以为重试策略可按状态码调 |
| 2 | 业务错误计入熔断 → 一个刷配额的客户端能把整条 lane 打挂 | 复核子代理标注的"已知局限"时确认这不是局限而是反向失效 | 拆出 `reportBusinessError`，只计数不计熔断 |
| 3 | 我自己写的对照组测试传错了重载 | 测试失败，`currentFailures` 期望 1 得 0 | 单参数重载会自建熔断器，断言查的是另一个对象。改为显式传入并加注释 |
| 4 | 告警脚本把标签值当指标名 | 首跑就报 `circuit_open` 未知指标 | 先剥 `{...}` 再抽标识符；这是脚本自身的假阳性 |
| 5 | 告警规则 `AiCallDepthExceeded` 漏了 `for` | 同一脚本的结构校验 | 补 `for: 1m`。没有持续时间的告警会抖动 |
| 6 | 视觉回归改动后仍不跑 | 跑了一次发现 "No tests found" | 两个原因：`import.meta` 在 CJS 转译下不可用；循环变量 `path` 遮蔽了 `node:path` |

## 二、纠错：我上一轮给用户的结论有错

上一轮我说「`globIgnores` 只排除 `**/3d/**`，`public/` 下 2K 贴图仍进 precache，7.3MB」。

**这是错的。** 实测 `dist/sw.js` 清单：126 条里 `3d/`、`.hdr`、`.ktx2` 条目 **0 条**，排除一直生效。

真实的 7.21MB 构成是：`china-map` 981KB、`tres`(Three.js) 821KB、瓷器/紫砂贴图 ~1.2MB、`og-cover` 515KB，其余为正常应用资源。其中唯一确定浪费的是 `og-cover.png`——只在 `index.html` 的 `og:image`/`twitter:image` 出现，用户页面从不渲染却被预缓存。排除后 7.21 → 6.70MB。

剩下的大头都是页面真要用的。要不要为安装体积牺牲离线完整性是产品取舍，本轮不擅自决定。

**教训**：没量过就说"清单里有什么"，和编造没有区别。

## 三、HTTPS：为什么这次敢说"能用"

上一轮 443 只是注释里的占位，没人验证过。这次在生产同款镜像里真跑：

| 验什么 | 结果 |
|---|---|
| `nginx -t`（用 `nginx/Dockerfile` 完整构建的生产镜像，含 brotli；临时自签证书） | `syntax is ok`，无 warning |
| `curl -k https://localhost:18443/` | 200 + 6 个安全头 + 一条 HSTS（自签证书） |
| `curl http://localhost:18081/` | 301 → `https://localhost/` |
| `/.well-known/acme-challenge/<token>` | **404，不是 301** —— 挑战被跳走证书就永远续不了 |
| `/actuator/prometheus` | 404（指标不公网可达） |
| `openssl s_client -alpn h2` | `ALPN protocol: h2` |

设计决定：**取消 80/443 的 location 双副本**。原注释理由是"怕漂移难排查"，但 150 行手抄两遍才是漂移的必然来源。抽出 `app-locations.conf`，**只在 443 引用**。

我最初的要求是"两个 server 都 include"，子代理没照做并给出了理由，它是对的：80 若 include 同一套 location，`/api/` 与 `/assets/` 在明文下仍然可用，等于给 TLS 开侧门；而 80 用 server 级 `return` 会把 ACME 挑战一起跳走、证书永远续不了。最终 80 = `^~ /.well-known/acme-challenge/` + `location / → 301`，location 集合只有一份，漂移源为 0——比我的原方案更彻底。**这是本轮唯一一次「执行者拒绝指令且拒绝得正确」的地方，保留记录。**

顺手清掉 `gzip_types`/`brotli_types` 里重复的 `text/html`（nginx 内置它总是压缩），`nginx -t` 从 2 条 warning 变 0 条。

## 四、告警：阈值不是拍脑袋，但也不假装它是校准过的

- 延迟阈值：来自 `application.yml` 的 SLO 常量与 `AiCallExecutor` 的 20s 硬超时，有依据。
- 错误率 / 兜底率：**标为初始值**。系统尚未承接真实流量，没有基线可依；上线后观察一周拿 P50/P95 分布再收紧。带着未校准阈值上线，结果一定是告警疲劳——那时真故障就没人看了。

promtool 一开始拉不到镜像（`auth.docker.io` EOF），所以先自写了 `verify-alert-rules.cjs`；后来镜像拉通，promtool 也跑过：

```
promtool check rules  → SUCCESS: 13 rules found
promtool check config → SUCCESS: 1 rule files found / valid prometheus config file syntax
```

两者互补，都保留：promtool 校验 PromQL 语法与配置结构（权威），自写脚本多查一件 promtool 查不出的事——**表达式里的指标名是否真的在代码里埋过**。指标名写错是 Prometheus 最典型的静默失效（不报错、永不触发），已做负向验证（把 `fallback_hit` 改成 typo，脚本立刻报错）。

## 五、质量指标：口径与降级

- 零样本返回 `null` 不是 0（0 会被读成"答得很差"）；已评 <20 不给中位数。
- 判官三条不可用路径（key 缺失 / 502 或熔断 / 输出非 JSON）全部返回 `empty` 并整批降级到规则判官，一条都不抛——判官挂了不能影响被测系统。批量内首次失败即整批降级，避免 20 条各等一次 20s 超时。
- `lane="judge"` 独立熔断桶，不与用户对话链路共享。
- 默认关闭（`enabled=false`）：LLM 评分有成本，默认不烧钱。

**规则判官有三个已知盲区**（已写进类注释）：无「茶」后缀的编造名识别不到；语气判不出"礼貌但冰冷"；可操作性只数要素不判对错。所以它不能作为质量结论的唯一依据，只是 LLM 不可用时的下限对照。

## 六、Tool Calling：默认关闭是对的

未配置实验 / `control` 分支的 prompt 与流程逐字不变（工具措辞另起常量）。否则"上线一个未启用的实验"就把线上 prompt 改掉了——这正是 ADR-024 里 `assignActive` 存在的理由。

已知代价：上游超时/502 经 `AiCallExecutor` 统一包成 `BadGatewayException`，也会触发回落，最坏延迟约 2× 超时预算。灰度期看 `tea.ai.toolcalling.fallback` 计数决定是否收紧。

## 七、验证证据（主控实跑）

| 命令 | 结果 |
|---|---|
| `mvn clean test`（Docker 已启用） | **487 run / 0 fail / 0 error / 0 skipped / BUILD SUCCESS** |
| `npm run quality` | exit 0 |
| `node scripts/verify-harness.cjs` | `ERRORS: []` |
| `node scripts/audit-redlines.cjs` | `ERRORS: []` |
| `node scripts/audit-wiki-drift.cjs` | 52 登记 / 52 代码，`ERRORS: []` |
| `node scripts/verify-alert-rules.cjs` | 埋点 12 / 规则 13 / 面板 10，`ERRORS: []`（+负向验证） |
| `node scripts/verify-nginx-headers.cjs` | 2 server / 13 location，`ERRORS: []` |
| `node scripts/verify-nginx-routes.cjs` | 19 = 19，`ERRORS: []` |
| `npx playwright test e2e/visual-regression.spec.ts` | 3 passed（改前 3 skipped） |
| `openssl s_client -alpn h2` | `ALPN protocol: h2` |

## 八、遗留（明确定性）

1. **未部署**。配置与脚本就绪，但生产机 `root` 公钥未授权、仓库无 SSH 凭据，我无法登录 42.121.125.4。部署需要你执行或提供访问方式。
2. **证书未签**。签发脚本默认 staging（防打满配额）；首次正式签发需人工确认 IP 与邮箱。
3. **告警阈值未校准**。需真实流量一周。
4. **Tool Calling 无真模型端到端验证**。本机无 DashScope key，"模型是否真会调工具、网关是否把结果回灌"属**未复核断言**，灰度前应 1% 流量或 staging 实跑一次。
5. **`AiChatService` 仍是 18 参构造器**。本轮没有重构：它在强依赖链中心，改动会污染 4 个测试文件，且不解决任何线上问题。建议下一轮单独抽 `AiChatDeps`。

## verdict

🔴 0 🟡 0 —— 通过（有条件）。

四项里三项（HTTPS / 告警 / 质量指标）都在真实容器或真实库上验过；Tool Calling 的代码路径有 24 例测试覆盖，但**模型侧行为未经真实验证**，这是唯一一处"代码对但没在真实条件下跑过"的地方，已明确标注。另纠正上一轮一处错误结论（预缓存构成），并把它记进 lesson。
