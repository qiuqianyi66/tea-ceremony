# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/) 与 [语义化版本](https://semver.org/lang/zh-CN/)。

## [1.0.0] - 2026-09-04

首个正式发布：沉浸式在线茶道体验应用，覆盖「入席 → 选茶 → 备器 → 煮水 → 冲泡 → 品鉴 → 个人成长」完整闭环，具备离线优先、可解释评分、AI 降级与生产级工程能力。

### Added — 核心体验

- 选茶—冲泡—品鉴完整流程：六大茶类目录、茶器与水选择、真实计时的冲泡交互（煮水 / 温杯 / 醒茶 / 分泡出汤）
- 可分享品鉴卡：八维雷达图、最终评分、冲泡参数、天气心情与 AI 茶记
- 品鉴卡分享链接（base64url 编码）与二维码，`/share` 只读分享页
- 品鉴卡 PNG 下载（内置二维码）
- 离线优先存储：品鉴记录先写 IndexedDB（Dexie），再异步同步后端，带失败重试与防重复写入
- 可解释评分模型：八维口感 × 冲泡工艺系数
- 茶文化 RAG 检索与茶灵 AI（规则引擎降级）

### Added — 工程与质量

- 自动化测试体系：
  - Playwright 端到端测试，覆盖完整冲泡流程与分享页（真实计时）
  - Vitest 前端单元测试（评分模型 / 茶 store / 分享编解码 / AI 降级）
  - pytest 后端 API 测试（认证 / 品鉴记录 / AI 代理 / 限流 / 错误格式 / 健康检查）
  - Alembic 迁移测试（真实 PostgreSQL）
- GitHub Actions CI：7 个 job（类型检查 / 构建 / 前端单测 / E2E / 后端测试 / 迁移测试 / Compose 校验）
- 路由冒烟测试（`npm run smoke`）
- GitHub Pages 静态 Demo 部署（SPA fallback）
- 后端 AI 代理路由 `/api/ai/*`：浏览器不直连第三方 LLM，失败自动降级
- API 限流（IP + 路径滑动窗口）、统一错误格式、服务端访问日志与异常追踪
- 前端 `/health` 健康检查页
- 生产配置：CORS 默认仅同源、启动环境变量校验、数据库备份文档

### Changed

- 前端 AI 请求从浏览器直连 Pollinations 改为经后端代理转发
- CORS 生产环境默认仅允许同源（Nginx 代理 `/api`），可通过 `CORS_ORIGINS` 覆盖
- 登录失败记录服务端日志，统一 401 文案防止用户枚举

### Fixed

- App 根组件 Transition 导致白屏
- 冲泡页粒子动画 startRipple 竞态导致界面卡死
- IndexedDB 复合索引 multiEntry 导致整库无法打开
- `toRaw` 写入 IndexedDB 崩溃
- 茶席跳转断裂
- bcrypt 版本锁定（4.0.1）兼容性
- SPA fallback 在 preview 与 Pages 下的路由支持
- 离线记录重试可能重复写入

---

## [0.x] - 早期开发（未发布）

- `5ddb5a5` 项目初始化：架构 + 数据 + 视图
- `dafd43a` 完整项目交付：沉浸式品茶体验与数据链路
- `6d73398` API 服务 + 注册修复 + 部署整合
- `4ebb4b3` AI 超时修复、茶味人格、知识库、结构化数据
- `c2917c3` 修复冲泡与离线存储的真实缺陷
