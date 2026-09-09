# CLAUDE.md — 一盏茶项目（Claude Code 指引）

> 本项目规则以 `AGENTS.md` 为**单一权威源**（AGENTS.md 开放标准，Codex / Cursor / Gemini CLI / Copilot 同读）。
> Claude Code 读本文件：请先读 `AGENTS.md` 全文并视为最高约束；本文件只做入口与速查，不重复全文。

## 必读顺序

1. `AGENTS.md` — 不可妥协 / 写码纪律 / 必守规则 / 边界 / 命令速查（先读全文）。
2. 设计任务 → `FRONTEND_DESIGN_SPEC.md`（通用前端设计规范：Design Read → 三拨盘 → 禁令 → 质量底线 → 设计审计）。
3. 设计任务 → `.agents/skills/frontend-design/SKILL.md`（Anthropic 官方防模板方法论）。
4. 3D 任务 → `3D_SPEC.md`。
5. 匹配的技能必须先 Read 对应 `SKILL.md` 再执行。

## 关键约束（速查，权威版在 AGENTS.md）

* 简体中文优先；绝不编造；最小必要修改；困惑就停。
* Vue 3 Composition API + `<script setup lang="ts">`，禁 Options API、禁 `any`。
* 组件 ≤ 200 行；样式 Tailwind 4，不写自定义 CSS 文件。
* AI 请求必须走后端代理 `/api/ai/*`，禁止浏览器直连第三方 AI。
* 数据库改动必须先读 `db-migration` 技能再动。
* 密钥绝不提交 / 回显；AI 生成区与人类区分离。

## 验证基线（改完必跑）

```
npm run type-check   # 最小门槛
npm run test         # 改了逻辑/store/service
npm run build        # 提交前必跑
node scripts/verify-gardens.cjs   # 3D 茶园四园晴雨截图，期望 ERRORS: []
```

## 设计速查（权威版在 FRONTEND_DESIGN_SPEC.md）

* 开工先输出一行 Design Read（页面类型 / 受众 / vibe / 倾向体系），再设三拨盘（基线 8/6/4）。
* 禁：AI 紫渐变、Inter / 衬线体默认、眉题 eyebrow、Hero+三卡片、卡片套卡片、玻璃拟态装饰、渐变文字、Emoji 图标、每节同款入场动效。
* 必做：一页一个强调色全页锁定；浏览器表面定制（选区 / 滚动条 / 焦点环）；一个编排时刻。
* 验收：一眼认不出是模板，也认不出是 AI 生成的。
