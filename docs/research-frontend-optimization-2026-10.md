---
last_updated: 2026-10-07
status: active
owner: yanha
---

# 前端优化增量研究（2026-10-07）

> 外部学习（GitHub/Gitee/掘金/CSDN/SegmentFault/官方文档）× 项目现状（PERF_BASELINE / research-frontend-2026-09-18 / 本次实测）对照产出的增量优化建议。
> 标注：【官方】= 官方文档建议；【实战】= 社区实战经验（一方称，需自验）；【已做】= 本项目已落地。
> 判据约束：不新增页面 / 离线优先 / 埋点无外发 / 不破坏 AI 降级承重墙。

## 1. 已落地项（先确认，不重复做）

| 项 | 现状 | 来源核验 |
|---|---|---|
| 路由懒加载 | ✅ 20 路由全动态 import，tres/echarts 不进首屏 | router/index.ts + PERF_BASELINE（首屏 JS 367KB） |
| 图片压缩 | ✅ hero/tearoom-bg 压缩（716→407KB） | PERF_BASELINE §2 |
| 压缩传输 | ✅ gzip + brotli（nginx） | nginx.conf L21-30 |
| PWA | ✅ precache ≈4MB、prompt 更新模式、navigateFallback、离线深链 | vite.config.ts L33-106 |
| CSP/安全头 | ✅ 补全（object-src/base-uri/frame-ancestors/worker-src） | nginx.conf L11 |
| 构建分析 | ✅ rollup-plugin-visualizer（VISUALIZE=1 条件启用） | vite.config.ts L7/L30 |
| 3D 纹理 | ✅ KTX2 + CacheFirst 运行时缓存 | vite.config.ts L90-98 |
| XSS 面 | ✅ 全仓 0 处 v-html/innerHTML | research-frontend 已测 |

## 2. 外部最佳实践摘要（学习来源）

### 性能（首屏/LCP/体验）
- 【官方】Vue 性能：压缩 bundle + 路由懒加载 + tree-shaking 最有效；营销页优先 SSG/静态 HTML 少 JS。https://vuejs.org/guide/best-practices/performance
- 【实战】腾讯云 3.5s→0.8s：核心原则=减少首屏需加载解析的资源量；路由懒加载最见效。https://cloud.tencent.com/developer/article/2561313
- 【实战】SegmentFault 手册：三方向=减体积（代码分割/按需引入）、提速度（资源格式/CDN/请求策略）、优体验（骨架屏+加载态，降低白屏焦虑）。https://segmentfault.com/a/1190000047347827
- 【实战】掘金全链路：图片懒加载（vue3-lazy / 原生 loading="lazy"）、Web Vitals 监控（PerformanceObserver 采集 LCP/INP/CLS）。https://juejin.cn/post/7619250267456929827、https://juejin.cn/post/7527865199862546459
- 【官方】Web Vitals 目标：LCP ≤2.5s、INP ≤200ms、CLS ≤0.1。

### RAG / AI 体验
- 【实战】企业级 RAG（LangGraph+Vue3）：混合检索（向量+BM25）+ Rerank 精排序 + **流式输出**（实时展示思考）+ Agent 工具调用。https://juejin.cn/post/7641058022769868806
- 【实战】RAGClaw 纯前端 RAG：文档/向量全存浏览器，隐私优先（本项目数据量小，纯前端向量化可行但暂无需求）。https://www.proginn.com/w/1575158
- 【全景】博客园 2026 RAG 生态九维盘点（LangChain/LightRAG/GraphRAG/Agentic RAG 等），选型参照。https://www.cnblogs.com/PLM-Teamcenter/p/20807318
- 【实战】引用可验证：RAG 回答应显示"依据的知识块"，用户可核对来源（grounded answer）。https://dev.to/attlar/i-built-a-grounded-rag-assistant-that-answers-from-any-github-readme-3p1k

## 3. 增量建议（按优先级）

| 优先级 | 项 | 内容 | 为什么 | 约束合规 | 工作量 |
|---|---|---|---|---|---|
| 🔸 P-O1 | **Web Vitals 落本地** | PerformanceObserver 采集 LCP/INP/CLS → IndexedDB（复用 tracking.ts 模式） | research-frontend 已标记未落地（P1-9）；真实场数据支撑后续优化 | ✅ 无外发 | 0.5d |
| 🔸 P-O2 | **LCP preload** | hero 图 `<link rel="preload" as="image">` | LCP 元素预加载减首屏等待（官方建议） | ✅ 仅 index.html | 0.1d |
| 🔸 P-O3 | **非首屏图片懒加载** | 茶卡/2D 图 `loading="lazy"`（原生，零依赖） | 列表页图片按需加载，降传输 | ✅ 不改行为 | 0.2d |
| 🔸 P-O4 | **RAG 引用展示** | 茶灵回复下显示检索命中的茶/诗引用卡片（fetchRAGContext 结构已可复用） | grounded answer：用户可见依据，可信度↑（对标 dev.to 实践） | ✅ 不动降级链 | 0.5d |
| 🔸 P-O5 | **AI 降级可见性** | 502 降级时回复尾部轻提示"已切换知识库回答" | 当前静默降级，用户不知情（可保留无缝或加提示，产品决策） | ✅ | 0.1d |
| 🔸 P-O6 | **manualChunks 实测拆分** | 先 visualizer 出 treemap，再评估 vendor（UI 库）拆包 | chunkSizeWarningLimit=1000 是"关警报"非"拆包"（research-frontend 指出） | ✅ 需先分析 | 0.5d |
| 🚫 暂缓 | 流式输出（SSE） | 后端 chat 流式 + 前端逐 token | 体验提升明显但改契约+降级链回归面大，数据量/单用户价值低 | ⚠️ 需评估 | 2d+ |
| 🚫 暂缓 | 向量化检索 | 66 条茶叶数据 ILIKE 足够，向量化过度工程 | 库增长（>1k 文档）再启用 | ✅ | — |
| 🚫 暂缓 | TS exactOptionalPropertyTypes | 工程严格度增强 | 可能触发大量类型报错，排期做 | ✅ | 1d+ |

## 4. 建议落地顺序

1. P-O2 + P-O3（1 小时内，零风险，直接收益）
2. P-O1（Web Vitals 落库，为后续优化提供数据）
3. P-O4（RAG 引用展示，茶灵体验提升）
4. P-O6（分析后再拆，谨慎）
5. P-O5 视产品决策（静默 vs 提示）

## 5. 验证方式

- P-O2/P-O3：DevTools 网络面板确认 preload 命中、图片滚动加载
- P-O1：页面加载后 IndexedDB 有 vitals 记录；重测 PERF_BASELINE 指标
- P-O4：茶灵提问含茶名 → 回复下方出现引用卡片
- 全部改动跑 `npm run type-check` + `npm run test` + 相关 e2e（a11y/aiask）

> 参考来源：
> <https://vuejs.org/guide/best-practices/performance>
> <https://cloud.tencent.com/developer/article/2561313>
> <https://segmentfault.com/a/1190000047347827>
> <https://juejin.cn/post/7619250267456929827>
> <https://juejin.cn/post/7527865199862546459>
> <https://juejin.cn/post/7641058022769868806>
> <https://www.proginn.com/w/1575158>
> <https://www.cnblogs.com/PLM-Teamcenter/p/20807318>
> <https://dev.to/attlar/i-built-a-grounded-rag-assistant-that-answers-from-any-github-readme-3p1k>
