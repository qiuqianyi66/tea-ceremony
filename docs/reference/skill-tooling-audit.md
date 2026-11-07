---
last_updated: 2026-11-07
status: active
owner: ai
---

# 技能可执行化审计（自动生成，勿手改）

> 生成：node scripts/audit-skill-tooling.cjs --write
> 技能 109 个（自写 43 / 导入 66）；脚本 63 个；解析失败 0 个

## 汇总

| 档位 | 数量 | 判定 |
|---|---|---|
| 可执行（引用 ≥1 个 scripts/） | 17 | 有一个确定性入口 |
| 半可执行（≥2 条命令行步骤） | 10 | 有命令但未沉淀成脚本 |
| 纯文档 | 82 | 全靠模型现场推导 |

孤儿脚本（零技能引用）：**16 / 63**——10 个在 CI/门禁或脚本间被调用（缺口在技能正文没点名），6 个 @oneshot 一次性诊断（使命已完结），0 个谁都不引用（该判「接给谁 / 删」）

## 可执行技能（已接上脚本层）

| 技能 | 来源 | 引用脚本 | 命令步骤 |
|---|---|---|---|
| db-migration | 导入 | generate-relations.mjs | 4 |
| fastapi-endpoint | 导入 | audit-wiki-drift.cjs | 4 |
| frontend-design | 导入 | scan-emoji.cjs、verify-icons.cjs、audit-touch.cjs、audit-type.cjs、audit-states.cjs、compress-assets.cjs、gen-hero-responsive.cjs、screenshot-home.cjs、screenshot-growth.cjs、screenshots-home-share.cjs、audit-hex.cjs、slim-china-map.cjs | 11 |
| plan-control | 导入 | verify-harness.cjs、eval-harness.cjs | 11 |
| tea-tasting | 导入 | audit-teas.cjs | 1 |
| vue-component | 导入 | audit-states.cjs、audit-touch.cjs、verify-brew-mobile.cjs、verify-brew-skins.cjs | 5 |
| 09-db-migration | 自写 | seed-extract.mjs | 1 |
| 18-3d-scene | 自写 | verify-gardens.cjs、verify-pavilion.cjs、verify-field.cjs、verify-final.cjs、verify-garden-ambient.cjs、verify-controls.cjs、screenshot-brew3d.cjs、convert-3d-ktx2.cjs、dl-textures.cjs、probe-brew.cjs | 11 |
| agent-eval | 自写 | agent-eval.cjs、eval-harness.cjs、validate-eval-cases.cjs、eval-tea-ai.cjs、calibrate-judge.cjs、eval-baseline-diff.cjs、eval-extract-regression.cjs、diagnose-rag.cjs | 9 |
| arch-deepen | 自写 | gen-repomap.cjs | 2 |
| coding-skill | 自写 | audit-redlines.cjs | 2 |
| deploy-verify | 自写 | smoke.mjs、verify-production.cjs、pwa-offline-smoke.cjs、verify-alert-rules.cjs | 6 |
| quality-audit | 自写 | audit-redlines.cjs、verify-harness.cjs、audit-wiki-drift.cjs、add-doc-meta.cjs、audit-context-migration.cjs、audit-skill-tooling.cjs | 21 |
| retro | 自写 | verify-harness.cjs、audit-redlines.cjs、audit-wiki-drift.cjs、measure-ai-commits.cjs | 11 |
| session-handoff | 自写 | verify-harness.cjs | 10 |
| tea-voice | 自写 | scan-emoji.cjs | 2 |
| 01-feature-dev | 自写 | verify-gardens.cjs | 6 |

## 半可执行（有命令、未沉淀）

| 技能 | 来源 | 命令步骤 |
|---|---|---|
| javascript-node | 导入 | 8 |
| shadcn | 导入 | 20 |
| 10-scheduled-task | 自写 | 2 |
| expert-reviewer | 自写 | 2 |
| request-analysis | 自写 | 2 |
| unit-test-ci | 自写 | 9 |
| 02-code-review | 自写 | 3 |
| 03-debug-issue | 自写 | 7 |
| 04-performance | 自写 | 6 |
| 00-bug-diagnose | 自写 | 10 |

## 纯文档（零确定性入口）

composition-patterns、css-animations、css-layout、css-responsive、design-md-collection、html-a11y、html-forms、javascript-data、javascript-debug、javascript-dom、javascript-performance、javascript-testing、show-me、threejs-animation、threejs-atmosphere-aerial-perspective、threejs-bloom、threejs-camera-direction、threejs-exposure-color-grading、threejs-geometry、threejs-image-pipeline、threejs-impl-lighting、threejs-impl-post-processing、threejs-impl-shadows、threejs-interaction、threejs-lighting、threejs-loaders、threejs-materials、threejs-parallax-occlusion-mapping、threejs-postprocessing、threejs-precipitation-surfaces、threejs-procedural-animation、threejs-procedural-fields、threejs-procedural-geometry、threejs-procedural-materials、threejs-procedural-vegetation、threejs-procedural-vfx、threejs-screen-space-ambient-occlusion、threejs-shaders、threejs-shadow-systems、threejs-syntax-loaders、threejs-temporal-surfaces、threejs-textures、threejs-visual-validation、threejs-volumetric-clouds、typescript-config、typescript-debug、typescript-testing、typescript-types、typescript-vue、ui-styling、vue-architecture、vue-axios、vue-composables、vue-debug、vue-pinia、vue-router、vue-testing、vueuse、01-crud-scaffold(自写)、02-pagination-query(自写)、03-caffeine-cache(自写)、04-spring-event-async(自写)、05-transaction-consistency(自写)、06-exception-handling(自写)、07-business-validation(自写)、08-excel-import-export(自写)、11-file-upload(自写)、12-growth-notification(自写)、13-stats-report(自写)、14-ai-agent(自写)、15-rag-pipeline(自写)、16-ai-fallback(自写)、17-offline-sync(自写)、19-design-taste(自写)、caveman-review(自写)、pr-body(自写)、unit-test-write(自写)、01-slow-sql(自写)、02-oom(自写)、03-cpu(自写)、04-ai-exception(自写)、05-rag-quality(自写)

## 引用异常

无：正文引用的每个脚本都存在且可解析。

## 孤儿脚本：门禁/CI 在调用、但技能正文未点名（缺口在技能侧）

`audit-context-budget.cjs`、`audit-eval-rag.cjs`、`audit-gitleaks-fingerprints.cjs`、`audit-levels-consistency.cjs`、`audit-probe-selectors.cjs`、`audit-skill-usage.cjs`、`eval-core.cjs`、`skill-usage-parse.cjs`、`verify-nginx-headers.cjs`、`verify-nginx-routes.cjs`

## 一次性诊断（@oneshot，不接技能入口）

`compare-judge-agreement.cjs`、`diag-glare.cjs`、`diag-glare2.cjs`、`gen-judge-checklist.cjs`、`gen-judge-samples.cjs`、`inspect-brew-corner.cjs`

## 真孤儿脚本：谁都不引用（逐个判「接给谁 / 删」）

（无）
