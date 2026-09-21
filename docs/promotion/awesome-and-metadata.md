# Awesome 列表 PR 文案 + GitHub 元数据

---

## 一、GitHub 仓库元数据（你在 Settings 页直接复制粘贴）

### About 描述（一行）

```
沉浸式在线茶道：Vue 3 + Three.js 3D 茶席，Dexie 离线优先；FastAPI + PostgreSQL，可自托管。
```

### Topics 标签（一行一个，全选）

```
vue3
typescript
threejs
tresjs
vite
pwa
offline-first
fastapi
postgresql
dexie
indexeddb
tailwindcss
tea
gongfu-cha
webgl
```

> 旧 topics 里的 `docker` 删掉（已弃用）；补 `threejs` / `tresjs` / `pwa` / `offline-first` 这些搜索量大但你之前没挂的标签。

### Website 字段

填：`https://qiuqianyi66.github.io/tea-ceremony/`

### Social preview

GitHub → Settings → Social preview 上传 `docs/screenshots/og-cover.png`。这是分享到 Twitter/LinkedIn 时显示的大图。

---

## 二、awesome 列表 PR

> 这些仓库通常要求：项目活跃、README 完整、不放自己的（self-promotion 是灰色地带，挑和项目类型最匹配的提 1-2 个就够，别全提）。

### 1. vuejs/awesome-vue

PR 标题：

```
Add Tea Ceremony — immersive 3D gongfu tea experience built with Vue 3 + TresJS
```

插入位置：在 `## Open Source Apps` 或 `## Examples` 段落中找合适位置。

描述：

```markdown
- [Tea Ceremony](https://github.com/qiuqianyi66/tea-ceremony) — An immersive 3D gongfu tea experience built with Vue 3 + TypeScript + TresJS (Three.js). Offline-first via Dexie/IndexedDB, PWA-installable, with a FastAPI + PostgreSQL backend. Live demo: https://qiuqianyi66.github.io/tea-ceremony/
```

### 2. brenty/awesome-threejs（或某活跃的 threejs awesome）

PR 标题：

```
Add Tea Ceremony — a 3D tea brewing scene built with Three.js
```

描述：

```markdown
- [Tea Ceremony](https://github.com/qiuqianyi66/tea-ceremony) — A stylized 3D gongfu tea table scene (Three.js / TresJS) with steam particles, tea liquor color progression, and KTX2 compressed textures. Full brewing loop, offline-first. Live demo: https://qiuqianyi66.github.io/tea-ceremony/
```

### 3. davidlynch/awesome-pwa（或某活跃的 pwa awesome）

PR 标题：

```
Add Tea Ceremony — offline-first PWA tea experience
```

描述：

```markdown
- [Tea Ceremony](https://github.com/qiuqianyi66/tea-ceremony) — Offline-first PWA (vite-plugin-pwa, Dexie + IndexedDB) for an immersive 3D tea ceremony. Records sync when back online; installable on mobile and desktop. Live demo: https://qiuqianyi66.github.io/tea-ceremony/
```

> 提 PR 前先看目标仓库的 CONTRIBUTING——有些要求最新 commit 在 6 个月内、有些要求 star 数门槛。被拒了不丢人，换一个列表。

---

## 三、其他可发现性优化

1. **GitHub Profile README**：如果你有 `qiuqianyi66/qiuqianyi66` profile 仓库，把「一盏茶」列成置顶项目，加一句描述和 demo 链接。
2. **Topics 页曝光**：挂了上面那些 topic 后，别人在 github.com/topics/vue3 这类页能刷到你，这是自然流量的大头。
3. **Releases**：现在只有 v1.0.0（2 周前）。下一次大改动后打个 v1.1.0 release，写清楚 changelog——release 会出现在项目的 Releases 页和你的动态流里。
4. **GitHub Discussions**：Settings → 打开 Discussions，开一个「你最喜欢哪款茶」的讨论帖，给访客一个评论入口。

---

## 四、不要做的事

- 不要买 star、不要去 r/programming 之类泛版块刷 Show & Tell——容易被判定 spam
- 不要把 README 塞满徽章（现在 4 个刚好，再加就廉价了）
- 不要在 awesome 列表里写"best/top/amazing"这类主观词，客观描述功能即可
- Demo 打不开之前不要发任何帖
