# 一盏茶 · Tea Ceremony

沉浸式在线茶道体验应用：从入席、选茶、备器、煮水、冲泡，到品鉴记录，完整模拟一场东方茶席。

[![CI](https://github.com/qiuqianyi66/tea-ceremony/actions/workflows/ci.yml/badge.svg)](https://github.com/qiuqianyi66/tea-ceremony/actions/workflows/ci.yml)
[![Vue 3](https://img.shields.io/badge/Vue-3-42b883?logo=vuedotjs&logoColor=white)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-ready-2496ed?logo=docker&logoColor=white)](docker-compose.yml)

在线静态 Demo（启用 GitHub Pages 后）：[qiuqianyi66.github.io/tea-ceremony](https://qiuqianyi66.github.io/tea-ceremony/)

## 为什么做这个项目

很多“茶文化”产品停留在内容展示层。「一盏茶」尝试把文化内容转化成一个可操作、可反馈、可持续记录的数字体验：用户选择茶叶和茶器，控制水温与浸泡时间，再根据茶汤、香气和口感完成品鉴。

## 核心体验

- 茶席入场：时间、节气、主题茶室和环境音构成沉浸式首页
- 选茶与备器：六大茶类、茶器解锁、水源选择和茶文化资料
- 真实交互冲泡：投茶量调节、温度控制、煮水/蒸汽/茶汤/出汤反馈、连续冲泡
- 结构化品鉴：观色、闻香、品味三步流程，八维评分与工艺系数
- 个人成长：IndexedDB 离线历史、XP、成就和茶器收藏
- AI 茶灵：茶文化 RAG 检索 + LLM，网络不可用时自动降级到规则回复
- PWA 与部署：可安装、离线可用，Docker Compose 一键启动前后端和 PostgreSQL

## 技术亮点

### 离线优先的数据层

前端使用 Dexie.js 封装 IndexedDB，品鉴记录先本地落盘，再尝试同步服务端；网络恢复后自动重试失败记录。用户完成品茶不依赖网络，数据也不会因为一次请求失败而丢失。

### 可解释的评分模型

品鉴结果由八维口感评分和冲泡工艺系数共同计算。水温、浸泡时间、茶器和水源都会影响结果，便于继续扩展为更完整的茶道体验模型。

### 前后端分层与安全边界

前端 Vue 3 + Pinia + Vue Router 负责交互和状态；FastAPI + SQLAlchemy + PostgreSQL 负责账户、品鉴记录和茶文化检索；Nginx 负责 SPA fallback、API 代理、缓存和安全响应头。

### 可验证的工程流程

GitHub Actions 会在 push 和 Pull Request 时执行：

- Vue/TypeScript 类型检查
- 生产构建
- Python 源码编译检查
- Docker Compose 配置校验

## 项目结构

```text
tea-ceremony/
├─ src/
│  ├─ views/              # 茶室、选茶、冲泡、品鉴、茶灵等页面
│  ├─ components/         # 茶汤、图表、冲泡交互组件
│  ├─ stores/             # Pinia 业务状态
│  ├─ services/           # API、IndexedDB、评分、AI 服务
│  ├─ data/               # 茶叶、茶器、茶人、节气和文化资料
│  └─ router/             # 路由和冲泡流程守卫
├─ backend/
│  ├─ app/routers/         # auth、teas、records、culture API
│  ├─ app/services/        # 茶文化检索与文本切分
│  └─ seeds/               # 初始茶叶与文化数据
├─ .github/               # CI、Issue 和 PR 模板
├─ docker-compose.yml
└─ nginx.conf
```

## 本地运行

### 只运行前端

```bash
npm install
npm run dev
```

本地开发环境默认请求 `http://localhost:8000/api`。如果只想体验前端，内置茶叶目录和 IndexedDB 仍可工作。

GitHub Pages Demo 使用内置茶叶目录和浏览器本地存储，完整账号同步功能需要运行 Docker 后端。

### 运行完整服务

```powershell
Copy-Item .env.example .env
# 编辑 .env，设置 SECRET_KEY 和 PostgreSQL 密码
npm run build
docker compose up -d --build
```

首次启动后可导入种子数据：

```bash
docker compose exec backend python -m seeds.run
```

## 常用命令

```bash
npm run dev          # 开发服务器
npm run type-check   # Vue/TypeScript 类型检查
npm run build        # 类型检查 + 生产构建
npm run preview      # 预览生产构建
npm run smoke        # 检查生产预览下的主要路由
```

欢迎通过 Issue 反馈问题或提出茶文化体验相关的改进建议，贡献流程见 [CONTRIBUTING.md](CONTRIBUTING.md)。

## 简历项目描述

> 独立设计并开发「一盏茶」沉浸式茶道体验应用，使用 Vue 3、TypeScript、Pinia、Dexie.js、FastAPI、PostgreSQL 和 Docker 构建完整的选茶—冲泡—品鉴闭环；实现 IndexedDB 离线优先存储与失败重试、基于规则的可解释评分模型、茶文化 RAG 检索与 AI 降级策略，并通过 GitHub Actions 自动完成类型检查、生产构建和 Compose 校验。

## 后续路线图

- 增加真实茶汤与茶器图片，补充项目演示截图和短视频
- 增加自动化端到端测试，覆盖完整冲泡流程
- 将 AI 第三方请求收敛到后端代理，避免浏览器直连外部服务
- 增加用户公开品鉴卡片和可分享的茶席链接

## License

当前项目用于个人作品集与学习展示。
