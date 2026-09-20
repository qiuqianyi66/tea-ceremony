# 安全政策（Security Policy）

「一盏茶」是个人/小团队免费自托管的开源项目。维护者用有限精力优先处理影响**数据丢失、账户失陷、离线优先承诺**的安全问题。

## 支持的版本

| 版本 | 支持状态 |
|---|---|
| main 分支（持续集成） | ✅ 支持 |
| 历史 release | ❌ 仅接受可复现漏洞报告，不保证修复 |

## 报告漏洞

**请不要在公开 Issues 里贴敏感细节**（密钥、PII、可利用的完整攻击链）。优先走 GitHub 的私有漏洞报告：

1. 打开仓库 **Security → Report a vulnerability**（GitHub 私有披露通道）。
2. 内容请包含：受影响版本/提交、复现步骤、影响、以及（如有）修复建议。
3. 若漏洞涉及运行中的数据，请勿附真实品鉴记录或凭据样例，用脱敏占位。

维护者承诺：

- 3 个工作日内确认收到报告；
- 确认有效后 30 天内给出修复计划或缓解措施；
- 修复发布前不公开细节（协调披露）。

## 已实施的安全基线（现状声明）

- 密码哈希：bcrypt cost=12（`bcrypt==4.0.1` 锁定）
- JWT：SECRET_KEY 启动校验 ≥32 字符；短期 access token
- 依赖供应链：Dependabot 三生态 weekly；CI 跑 `npm audit` 与 `pip-audit`
- 网络边界：AI 请求只走 `/api/ai/*` 后端代理，浏览器不直连第三方 AI
- 隐私：埋点（tracking / web-vitals）只写本地 IndexedDB，无网络外发（ADR-006）
- 部署：Docker 非 root 用户；Nginx 承载 TLS/HSTS（见 `DEPLOY.md`）

## 已知边界（不视为漏洞）

- 品鉴记录未做端到端加密（本地明文 IndexedDB）——项目定位非密码管理器，导出 JSON（P2-12）交由用户自行保管；
- 未登录游客数据仅存本地，清除浏览器数据即丢失（设计如此）。

## 修复流程

漏洞确认后：`fix: 安全修复 ...` 提交 → 全量 CI 门禁（type-check / Vitest / pytest / E2E / lint / audit）→ 合入 main → CHANGELOG 记录。
