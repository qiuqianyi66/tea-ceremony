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
👉 **Full version (with backend, public deployment)**：[http://42.121.125.4](http://42.121.125.4/)

![Tea Ceremony · cover](docs/screenshots/og-cover.png)

## What it is

Most "tea culture" apps stop at articles and photos. Tea Ceremony turns culture into something you *do*:

- **3D tea table**: TresJS / Three.js renders a wooden table with real teaware — steam on pour, liquor color on outflow, time / solar term / themed room shaping the mood
- **Full loop**: prepare → boil → warm → awaken → brew → observe color → smell → taste, scored by an 8-dimension mouthfeel model × brewing-craft coefficient
- **Offline-first**: Dexie.js + IndexedDB, records land locally first, sync when back online
- **Shareable**: one-tap tasting card with QR code / read-only share link / PNG — send this session to a friend
- **AI tea spirit**: five specialist roles (tea selection / brewing / tasting / tea culture / growth mentor) + RAG vector retrieval, gracefully falling back to rule-based replies when offline

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
| Data | Dexie.js + IndexedDB (offline-first, `sync_status` retry queue); PostgreSQL + pgvector (RAG vector retrieval) |
| Backend | Spring Boot 3.5 + Spring Data JPA + Spring AI Alibaba + Flyway (legacy FastAPI maintenance-only) |
| AI | Backend proxy only (`/api/ai/*`, browser never calls third-party AI directly), RAG vector retrieval + five specialist roles, DashScope, rule-based fallback |
| Deploy | Docker Compose (frontend / backend / postgres / nginx), public ECS online, GitHub Pages static demo |
| Tests | Vitest + fake-indexeddb, Playwright E2E + axe, Maven (211 tests + Testcontainers + ArchUnit), pytest (legacy) |
| CI | GitHub Actions, 13 jobs: type-check+build+smoke / Vitest / Biome / dependency audit / E2E / a11y / pytest / Spring Boot Maven / migration round-trip / compose validation / harness consistency |

## Engineering quality & governance

Process, rules and verification are written as code. Machines check them, not willpower.

- **AI collaboration rules**: `AGENTS.md` defines red lines, the dev process and a three-track triage (Fast / Guided / Controlled) — decompose first, then act, then verify
- **Architecture decision records**: ADR-001~020, every choice documented with "why A, why not B, when to reverse"; rejected options stay on record too (e.g. Graph orchestration, 0/4 after four-dimension screening)
- **Skill system**: 66 generic + 39 domain skills, loaded on demand, governed by README routing tables
- **CI merge gate**: all 13 jobs green before merge — type-check / unit / lint / dependency audit / E2E / a11y / backend dual-stack tests / migration round-trip / compose validation / harness consistency
- **Deterministic health checks**: `verify-harness.cjs` (ADR/CI/skills/paths consistency, expects ERRORS: []), `audit-redlines.cjs` (red-line mechanization), `audit-wiki-drift.cjs` (API contract cross-check)
- **AI eval loop**: 50-case eval set + LLM-as-Judge (95% agreement with human review) + full real score v3 0.81, scoring methodology traceable
- **Branch protection**: main is PR-only, merge requires a green CI

## Quick start

Frontend only (start here):

```bash
npm install
npm run dev
```

Full stack (Docker Compose: PostgreSQL + Spring Boot backend):

```bash
Copy-Item .env.example .env   # edit POSTGRES_PASSWORD, JWT_SECRET, DB_PASSWORD
docker compose up -d --build
# frontend http://localhost:5173, backend http://localhost:18080
```

Common: `npm run type-check` · `npm run test` · `npm run build` · `npm run test:e2e`
Backend tests: `cd backend && mvn -q test` (legacy FastAPI stack: `python -m pytest tests -q`)

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
