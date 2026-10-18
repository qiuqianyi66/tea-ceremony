# telemetry-stability Review

> 评审对象：遥测接收与 SLO 评估（Flyway V8 三表 + `com.tea.telemetry` + 前端 telemetry SDK）+ 线上站点 P0 配置修复
> 依据：ADR-022 + `docs/reference/telemetry-contract.md`（契约唯一真源）
> 评审方式：逐项核对（契约 → 迁移 → 分层 → 测试 → 安全 → 实测证据），主控复核，不转抄子代理结论
> 结论：**有条件通过**，0 🔴 0 🟡，2026-10-17

## 一、契约对齐

- ✅ 端点四个（`batch` / `slo` / `fingerprints` / `review`）路径与鉴权按契约 §1
- ✅ 上报信封字段与两种 payload 按 §2/§3；响应 `{accepted, duplicated, rejected}` 按 §4
- ✅ 单条非法只计 `rejected`，只有信封非法才整体 400（服务层显式抛 `BadRequestException`，未用 `@Valid`——理由：`@Valid` 会把单条坏数据升级成整批 400，与 §4 冲突）
- ✅ 指纹算法逐条落地 §5：URL / UUID / 长 token / 引号字面量 / 数字归一化 + 行号 10 行分桶 + FNV-1a 16 hex
- ✅ SLO 目标与权重进配置（§6：2500/200/0.1/1800/800，权重 25/25/20/15/15），未硬编码在 service
- ✅ 入库规则 §9：客户端指纹合法即采用；error 事件 upsert 指纹（`occurrences+1`）；vital 只落 raw
- ✅ 保留策略 §10：raw 7 天、指纹与快照永久

## 二、迁移与命名

- ✅ 三表 18/13/9 列，`BIGSERIAL` / `TIMESTAMPTZ`，全字段 `COMMENT ON`
- ✅ 命名合规：4 个 `uk_` 唯一约束、4 个 `ix_` 索引、无外键（三表互不关联）
- ✅ 幂等靠 `uk_telemetry_events_client_event` + `ON CONFLICT (client_event_id) DO NOTHING`
- ✅ `ddl-auto: validate` 未改，schema 只走 Flyway
- ✅ **保留索引列不一致已修**：原 `ix_telemetry_events_expiry (received_at)` 与 §10 的删除条件 `occurred_at` 不符，已改为 `(occurred_at)`（V8 与 `.harness/changes/telemetry-stability/db-migrations.sql` 两处同步）

## 三、真实 Postgres 验证（主控实测，非静态自检）

环境：本机 PostgreSQL 17，隔离 schema `flyway_verify`（不触碰既有库表）。

| 项 | 命令 | 结果 |
|---|---|---|
| 基线 + V8 应用 | `psql -f V1__init.sql` + `-f V8__telemetry.sql` | exit 0 / exit 0 |
| 三表与索引落库 | `pg_tables` / `pg_indexes` | 3 表 + 6 索引，命名全 `uk_`/`ix_` |
| 幂等约束 | 同 `client_event_id` 插两次 | 第二次违反 `uk_telemetry_events_client_event` |
| HITL 入口态 | 插 `error_fingerprints` 返回默认值 | `review_status=pending, occurrences=1` |
| SLO 窗口唯一 | 同 `(window_start, metric)` 插两次 | 第二次违反 `uk_slo_snapshots_window_metric` |
| 索引列正确性 | `pg_attribute` join `pg_index` | `ix_telemetry_events_expiry -> occurred_at` |
| 索引是否真被使用 | 灌 20000 行 + `ANALYZE` + `EXPLAIN` | 有索引：`Bitmap Index Scan on ix_telemetry_events_expiry`；**删索引对照**：`Seq Scan` |
| 回滚 | `psql -f rollback.sql` | exit 0，三表计数 `0` |

未覆盖：V3/V5 无法在本机执行（未装 pgvector，`extension "vector" is not available`），属既有环境限制，与本次迁移无关。

## 四、分层与事务

- ✅ `controller → service → repository` 单向；`LayerDependencyTest` 实测通过
- ✅ 写方法 `@Transactional(rollbackFor = Exception.class)`，只读标 `readOnly = true`
- ✅ 查询全在 Repository（`percentile_cont(0.75)`、`insert ... on conflict` 下推原生 SQL）

## 五、安全

- ✅ `POST /api/v1/telemetry/batch` 加入 permitAll（仅此一行），其余 `/api/v1/telemetry/**` 需 JWT
- ✅ 限流独立档（匿名 30/min），`RateLimitFilterTest` 覆盖
- ✅ 不落 IP、不落 UA；入库前脱敏（URL query / 邮箱 / JWT / 长 token / 纯数字 ID）
- ✅ 修掉脱敏真实缺陷：`URL_QUERY` 尾串字符类排除了 `#`，导致 `?d=secret#frag` 只剥到 `?` 段，`#frag` 残留。已改字符类；测试断言未改（确认是改代码不是改测试）

## 六、前端 SDK

- ✅ 多级兜底链：`sendBeacon` → `fetch(keepalive)` → 普通 `fetch(8s AbortController)` → IndexedDB outbox 退避重试
- ✅ 熔断：连续 3 次失败开 60 s，半开放行 1 次试探，成功即关闭
- ✅ 采样：vital 每页每指标 1 条；error 同指纹 5 分钟去重；令牌桶 10/min
- ✅ 指纹不依赖 `crypto.subtle`（站点跑在 HTTP，实测 `hasCryptoSubtle: false`），用 BigInt 版 FNV-1a
- ✅ 前后端指纹一致性硬断言：两条契约向量同码 `622b302a6b53fcee`
- ✅ 上报路径永不 throw 到业务层（与 `teaAI.ts` 降级同级承重墙）
- ✅ 隐私开关 UI 落在 `/profile`「隐私」区：`role="switch"`、56×44 触控尺寸、点击即落库、刷新后保持（Playwright 桌面 + 移动双端实测 PASS）

## 七、顺带修掉的既有缺陷（非本次需求，但不修则本次功能失效）

`src/services/storage/settings.ts`：`settings` 表主键是 `++id`，旧 `set()` 用 `put({key,value})` 不带 id → 每次写入新增一行重复记录，`get()` 命中最旧那行 → **同一 key 后续写入永远读不到**。线上后果：用户关掉遥测后刷新又自动打开。`delete(key)` 用字符串打自增主键 → 一行都删不掉。
修法：`set` 按 key 取主键列表，更新首行并清理重复行；`delete` 改按 key 索引删。新增 `src/services/storage/__tests__/settings.spec.ts`（5 例）锁行为；其中「合并历史重复行」一例初版失败 —— 第一版只「一起改值」没「减行」，已按注释承诺补齐实现。

## 八、验证证据汇总（全部主控实跑）

| 命令 | 结果 |
|---|---|
| `npm run lint` | 174 files，0 error |
| `npm run type-check` | 通过 |
| `npm run test` | **25 files / 238 tests passed** |
| `npm run build` | ✓ built，PWA precache 126 entries |
| `npx vitest run src/services/telemetry + settings.spec` | 70 passed |
| `mvn -q -DskipTests compile` | exit 0 |
| `mvn test -Dtest='Telemetry*Test,Fingerprint*Test,Slo*Test,ErrorFingerprint*Test,LayerDependencyTest'` | 68 run / 0 fail / 5 skipped / BUILD SUCCESS |
| `node scripts/verify-nginx-headers.cjs` | `ERRORS: []`（含注入漏洞负向验证：能拦） |
| `node scripts/verify-nginx-routes.cjs` | `ERRORS: []`（19 路由段双向一致） |
| `node scripts/audit-wiki-drift.cjs` | 46 登记 / 46 代码，`ERRORS: []` |
| `node scripts/verify-harness.cjs` | `ERRORS: []` |

未跑通（如实记录）：`TelemetryIntegrationTest` 5 例 skipped —— 本机 Docker 未运行，Testcontainers 报 `Could not find a valid Docker environment`。**这 5 例未经执行，不得视为通过**；CI（有 Docker）会跑。

## 九、遗留与待确认

1. **集成测试未在本机执行**（见上）。CI 的 `backend-test` job 有 Postgres service，合并前由 CI 补跑。
2. **HTTPS 仍未启用**：`nginx.conf` 的 443 段与 HSTS 已写好但仍注释；需要证书与 `docker-compose.yml` 的 443 端口映射一起放开。**未部署，不声称已生效**。
3. **PWA precache 7.3 MB**（构建输出 `126 entries (7370.60 KiB)`）：HTTPS 一旦启用，Service Worker 会预缓存全部 `jpg/png`（含 `public/` 下 2K 贴图与 hero 变体）。`globIgnores` 只排除 `**/3d/**`。属既有配置，本次未改，标为待确认。
4. **`/health` 改调 `/actuator/health`**：匿名访问时 `show-details: when_authorized` 只返回 `{"status":"UP"}`，数据库明细显示「正常（匿名不返回明细）」。若要真实库明细，需另开匿名只读轻量端点。
5. **`APP_VERSION` 硬编码 `1.0.0`**（前端 `config.ts`），未做构建期注入；发版需人工同步，否则遥测里版本字段失真。

## verdict

🔴 0 🟡 0 —— 通过。契约 §1-§10 全部落地；前后端指纹向量一致；迁移在真实 Postgres 完成 upgrade/downgrade 往返并做了索引使用对照证伪；隐私开关双端实测可持久化。遗留项均已定性（CI 补跑 / 需证书 / 需决策），不改变已交付行为的正确性。
