# 传播文案包

> 每个平台一版。文案改到 90%，你按自己语气微调。发之前确认在线 Demo 能打开。
> 配图：og-cover.png（docs/screenshots/og-cover.png）+ brew-3d-steeping.png + home.jpg

---

## 1. V2EX · 分享创造节点

**标题**：做了个浏览器里的 3D 工夫茶——「一盏茶」

**正文**：

```
花了几个月做了个小项目：在浏览器里完整走一遍工夫茶——入席、选茶、煮水、冲泡、品鉴。

不是茶文化百科，不是计时器，是一个能坐下来泡一杯茶的小茶室。

在线 Demo（直接打开，不用注册，离线也能用）：
https://qiuqianyi66.github.io/tea-ceremony/

做了什么：
- Three.js / TresJS 渲染的 3D 茶桌，注水有蒸汽，出汤看汤色
- 完整流程：备器→煮水→温杯→醒茶→冲泡→观色→闻香→品味
- 品鉴记录八维评分 × 冲泡工艺系数，可解释，不是黑盒
- Dexie + IndexedDB 离线优先，断网也能泡，联网自动同步
- 品鉴卡可生成二维码分享，把这席茶发给朋友
- FastAPI 后端 + PostgreSQL，PWA 可装到桌面

GitHub：https://github.com/qiuqianyi66/tea-ceremony

想听听大家怎么看，特别是 3D 泡茶的交互还有什么可以做的。
```

---

## 2. 即刻 · 短动态

```
给自己做了个浏览器里的茶室。

选茶、煮水、注水、出汤，看蒸汽起来、汤色变深，最后写一句品鉴。
断网也能用，PWA 能装到桌面。

Demo：https://qiuqianyi66.github.io/tea-ceremony/

不是科普，不是工具，是一个能坐五分钟的地方。
```

---

## 3. 掘金 · 技术拆解长文（大纲）

**标题建议**：我用 Vue 3 + Three.js 做了个浏览器里的 3D 茶室（离线可用）

**正文大纲**（按这个写，每节配一张截图）：

```
开头：为什么做——不是做个茶百科，是想做一个能"走进去"的茶室

一、技术选型
- 为什么是 Vue 3 + TresJS（不是 React Three Fiber）
- 为什么离线优先（Dexie + IndexedDB）
- KTX2 贴图压缩：2K 地面贴图 32MB → 0.9MB，basis transcoder 怎么配

二、核心难点
- 3D 冲泡的状态机：备器→煮水→温杯→醒茶→冲泡→出汤，每一步的反馈
- 品鉴评分模型：八维口感 × 工艺系数，为什么不用 LLM 直接打分
- 离线同步：sync_status 队列、toRaw 去代理防 DataCloneError
- AI 请求为什么必须走后端代理（CORS + API key 安全 + 降级策略）

三、工程化
- GitHub Actions 七 job 门禁
- Playwright E2E 怎么测 3D 动画（真实等待，不伪造时钟）
- Alembic 迁移往返测试

结尾：开源在 GitHub，欢迎提 issue
```

---

## 4. Reddit · r/vuejs（英文）

**标题**：Show and Tell: I built a 3D tea ceremony app in Vue 3 + TresJS (offline-first, PWA)

**正文**：

```
Hey r/vuejs — I'd love some feedback on a side project I've been working on.

**Tea Ceremony** is a browser-based, immersive gongfu tea experience: pick a tea, boil water, brew in a 3D tea table, then record a structured tasting. It's not a tea encyclopedia or a timer — it's a little digital tea room.

🔗 Live demo (no signup, works offline): https://qiuqianyi66.github.io/tea-ceremony/
📦 GitHub: https://github.com/qiuqianyi66/tea-ceremony

Stack:
- Vue 3 + TypeScript (strict) + Pinia + Vue Router + Tailwind
- Three.js via TresJS (KTX2 compressed textures, basis transcode)
- Dexie.js + IndexedDB (offline-first, retry queue with sync_status)
- FastAPI + PostgreSQL backend, PWA installable
- GitHub Actions CI: type-check, Vitest, Playwright E2E, pytest, Alembic migration round-trip

A few things I learned:
- KTX2 cut my terrain textures from 32MB to ~1MB per image
- 3D animations are hard to E2E test — we use real waits, no fake clocks
- AI requests go through a backend proxy only; the frontend falls back to rule-based replies when offline

Would love thoughts on the 3D interaction — what else would make brewing feel real?
```

---

## 5. Reddit · r/threejs（英文）

**标题**：Show: 3D tea brewing scene in Three.js — steam, pouring animation, tea table materials

**正文**：

```
Hi r/threejs — sharing a scene from a side project: a 3D gongfu tea table.

What's in it:
- A wooden tea table with porcelain / clay teaware (low-poly, stylized)
- Steam particle system that rises when water is poured
- Tea liquor color darkens as brewing progresses
- KTX2 compressed terrain + ground textures (ETC1S q160 + mipmaps, ~0.9MB per 2K texture)
- Basis transcoder loaded at runtime from /public

Live demo: https://qiuqianyi66.github.io/tea-ceremony/
GitHub (scene code in src/components/three/): https://github.com/qiuqianyi66/tea-ceremony

I'm still learning — would appreciate any pointers on making the steam and pouring feel more physical. The scene is deliberately quiet (no bloom, no heavy post-processing) to match the tea-room mood.
```

---

## 6. Hacker News · Show HN（英文）

**标题**：Show HN: A 3D tea ceremony app in the browser (Vue 3 + Three.js, offline-first)

**正文**：

```
Hi HN — I've been building a small project on and off for a few months, and would appreciate feedback.

Tea Ceremony is a browser-based gongfu tea experience: you enter a tea room, pick a tea (40 teas across the six Chinese tea categories), brew it on a 3D table — water boils, steam rises, the liquor darkens — then record a structured tasting.

It's offline-first (IndexedDB via Dexie, syncs to a FastAPI/PostgreSQL backend when online), installable as a PWA, and the AI "tea spirit" falls back to local rule-based replies when there's no network.

Live demo: https://qiuqianyi66.github.io/tea-ceremony/
GitHub: https://github.com/qiuqianyi66/tea-ceremony

The thing I'm most unsure about is the 3D brewing interaction — it's deliberately minimal (you don't "fight" the scene, it walks you through the steps), but I'm curious if that feels engaging or too passive.

Happy to answer questions about the offline sync model, KTX2 texture compression, or why AI requests go through a backend proxy.
```

---

## 7. Product Hunt（英文）

**Tagline**：A 3D digital tea room in your browser.

**Description**：

```
Tea Ceremony is a browser-based gongfu tea experience — pick a tea, brew it on a 3D table, and record a structured tasting.

Three things make it different:

1. **It's a place, not a tool.** Most tea apps are timers or encyclopedias. This one is a room you enter, with time of day, solar terms, and ambient sound shaping the mood.

2. **Offline-first.** Records land in IndexedDB first. You can brew on a plane with no wifi — it syncs when you're back online.

3. **Explainable scoring.** Your tasting is scored by an 8-dimension mouthfeel model × brewing craft coefficient (water temp, steep time, teaware, water source). Not a black-box LLM verdict.

Built solo with Vue 3, Three.js (TresJS), FastAPI, and PostgreSQL. MIT licensed.

Thanks for taking a look — feedback very welcome.
```

---

## 8. 小红书 · 视觉向

**标题**：在浏览器里泡了一杯 3D 工夫茶🍵

**正文**：

```
不是科普号，不是卖茶。
是一个能坐五分钟的小茶室。

选茶 → 煮水 → 注水 → 出汤
蒸汽会起来，汤色会变深
最后写一句品鉴，可以分享给朋友

断网也能用，PWA 装到桌面就是个小应用
免费，无广告，MIT 开源

Demo 在评论区。
```

配图建议：og-cover.png + brew-3d-steeping.png + home.jpg，三张。

---

## 9. 朋友圈 / 微博

```
给自己做了个浏览器里的茶室。
选茶、煮水、看汤色，五分钟不被打扰。

开源在 GitHub，Demo 直接打开。
```

---

## 发布节奏建议

| 时间 | 平台 | 备注 |
|------|------|------|
| Day 1 上午 | V2EX + 即刻 | 中文主阵地，先听早期反馈 |
| Day 1 晚上 | 朋友圈/小红书 | 视觉向，配三张图 |
| Day 2 | Reddit r/vuejs + r/threejs | 错开中文流量，英文技术圈 |
| Day 3 | 掘金长文 | 把前几天的反馈写进拆解 |
| 周末 | Show HN + Product Hunt | HN 周二到周四效果好，PH 美国时间凌晨发布 |

> 发之前务必：① 打开 Demo 真机测一遍 ② 手机端点一遍 ③ 确认 README 新图都加载了。
