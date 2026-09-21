# Tea Ceremony · 一盏茶

> One tea, one room, one quiet moment.

An immersive online tea ceremony: enter the room, pick a tea, boil water, brew, and taste — a complete gongfu cha session in the browser.
Not an encyclopedia, not a timer. A digital tea room you can actually walk into.

[中文](README.md) | **English**

[![CI](https://github.com/qiuqianyi66/tea-ceremony/actions/workflows/ci.yml/badge.svg)](https://github.com/qiuqianyi66/tea-ceremony/actions/workflows/ci.yml)
[![Vue 3](https://img.shields.io/badge/Vue-3-42b883?logo=vuedotjs&logoColor=white)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![PWA](https://img.shields.io/badge/PWA-offline-orange?logo=pwa)](https://web.dev/learn/pwa/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Try it now

👉 **Live demo (no signup, works offline)**：[qiuqianyi66.github.io/tea-ceremony](https://qiuqianyi66.github.io/tea-ceremony/)

![Tea Ceremony · cover](docs/screenshots/og-cover.png)

## What it is

Most "tea culture" apps stop at articles and photos. Tea Ceremony turns culture into something you *do*:

- **3D tea table**: TresJS / Three.js renders a wooden table with real teaware — steam on pour, liquor color on outflow, time / solar term / themed room shaping the mood
- **Full loop**: prepare → boil → warm → awaken → brew → observe color → smell → taste, scored by an 8-dimension mouthfeel model × brewing-craft coefficient
- **Offline-first**: Dexie.js + IndexedDB, records land locally first, sync when back online
- **Shareable**: one-tap tasting card with QR code / read-only share link / PNG — send this session to a friend
- **AI tea spirit**: tea-culture RAG + LLM through a backend proxy, gracefully falling back to rule-based replies when offline

## Screens

| Immersive home | 3D brewing | Tasting card |
| --- | --- | --- |
| ![home](docs/screenshots/home.jpg) | ![brew](docs/screenshots/brew-3d-steeping.png) | ![card](docs/screenshots/share.png) |

![select](docs/screenshots/select.png)
![pour](docs/screenshots/brew-3d-done.png)
![growth](docs/screenshots/growth-desktop.png)

## Who it's for

1. **Tea beginners** who want guidance and atmosphere, not a wall of taxonomy
2. **Regular drinkers** who want to record and build a personal archive
3. **Slow-living folks** who want a five-minute, undistracted break

No ads, no paywall, self-hostable, offline-capable.

## Stack

| Layer | Tech |
| --- | --- |
| Frontend | Vue 3 + TypeScript (strict) + Pinia + Vue Router + Tailwind CSS + Vite |
| 3D | Three.js / TresJS (KTX2 compressed textures, basis transcoder) |
| Data | Dexie.js + IndexedDB (offline-first, `sync_status` retry queue) |
| Backend | FastAPI + SQLAlchemy 2.0 (async) + PostgreSQL + Pydantic v2 + Alembic |
| AI | Backend proxy only (browser never calls third-party AI directly), DeepSeek, rule-based fallback |
| Deploy | Native Windows Server (NSSM + uvicorn + nginx for Windows), GitHub Pages static demo |
| Tests | Vitest + fake-indexeddb, Playwright E2E, pytest + Alembic migration round-trip |
| CI | GitHub Actions: type-check / unit / E2E / build / backend / migration / compose |

## Quick start

Frontend only (start here):

```bash
npm install
npm run dev
```

Full stack (requires local PostgreSQL + Python 3.12):

```powershell
Copy-Item .env.example .env   # edit SECRET_KEY, DATABASE_URL
cd backend
python -m venv .venv
.\.venv\Scripts\pip install -r requirements.txt
.\.venv\Scripts\alembic upgrade head
.\.venv\Scripts\python -m seeds.run
.\.venv\Scripts\uvicorn main:app --reload --port 8000
```

Common: `npm run type-check` · `npm run test` · `npm run build` · `npm run test:e2e`
Backend tests: `cd backend && .\.venv\Scripts\python -m pytest tests -q`

Docs: [DEPLOY.md](DEPLOY.md) · [CONTEXT.md](CONTEXT.md) · [DESIGN_SPEC.md](DESIGN_SPEC.md) · [3D_SPEC.md](3D_SPEC.md)

## Contributing

Start with a Good First Issue — adding a tea, translating a string, writing a test, drawing an icon all count.
See [CONTRIBUTING.md](CONTRIBUTING.md). Issue and PR templates are in place.

## Roadmap

- Replace placeholder teaware with real photography
- Expand tea catalog from 40 to 100+ Chinese teas
- Two-person shared sessions (evolve the read-only share card into a live tea party)
- Production Sentry error tracking + Redis rate limiting

## Credits

Home hero `src/assets/tea-mountain-hero.jpg`: photographer Tanmoy281, via [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Darjeeling-tea-plantation.jpg), [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.zh); resized and tone-mapped for morning-mist effect.
Tea photography: Pexels, commercially licensed.

## License

[MIT](LICENSE) © 2026 Yan Heng (qiuqianyi66)
