# HANDOFF-2026-10-06-execution.md — 昨日执行上下文（供新对话接续）

> 新对话接续：直接说「读 HANDOFF-2026-10-06-execution.md 继续」即可。
> 本文档只记事实与路径，不展开原理；细节按路径读原文。

## 1. 昨天（10-06）完成

**主线一：task-triage 技能打磨（用户级，已完成）**
- 学习 work 调配体系（分诊矩阵四象限 / 分层文档 doc-layer-slimming / SKILL_INDEX 6 列路由 / 技能即 git 仓库 + update-skills.ps1）。
- 用户指示「融入你自己，打造属于你自己的东西」，创建用户级技能：`C:\Users\yanha\AppData\Local\Doubao\User Data\Profile 2\.doubao\agent_mode\workspace\.user_skills\task-triage\SKILL.md`。
- 三轮迭代 + v4 补丁，最终约 90 行，结构：触发 → 与 plan-mode 分工 → 分诊结论格式 → 矩阵+判据+例子 → 硬门三条 → 阶段间重分诊 → 绑定三件 → 复盘校准 → 检查清单。
- v4 补丁三处（流程回放产出）：阶段间重分诊（新事实出现重判，只升不降）/ 每阶段出口 DoD 逐条核对 / 编码收尾查部署影响面（compose/DEPLOY/CI 接线）。
- 用户偏好升级：旧「先判断复杂度」p1_AQHdp9cqP8k 停用 → 新「task-triage 分诊」p1_AQhSRc-avWY 生效。

**主线二：T11（AI 切片）全量完成（tea 项目，已合入 main）**
- 后端 82 测试全绿 + CI 13 job 全过；`/api/v1/ai`、`/api/v1/culture` 已上线（AiChatController + CultureSearchController）。
- 降级链：`AI_DASHSCOPE_API_KEY` 默认 disabled → AiChatService 502 → 前端降级规则引擎（承重墙 teaAI.ts）。
- 相关提交：main @ b3e5b1e（caveman-review skill），T11 批次已合 main。

**主线三：M1 收尾遗漏修复（进行中，未完成）**
- 用 task-triage 走 T11 十阶段流水线回放，发现 3 个遗漏：
  1. 阶段 7 全栈 compose 端到端未跑（只到 Testcontainers 级）。
  2. 阶段 8 compose/DEPLOY.md 未接 AI_DASHSCOPE_API_KEY。
  3. 阶段 10 观测 deferred（ai_usage_logs 每日统计+预算告警 = M2 输入，非遗漏）。
- 遗漏 2 已修完（**未提交**）：docker-compose.yml / .env.example / DEPLOY.md 三处接线。
- 遗漏 1 进行中：发现**本地镜像落后于源码**（/api/v1/ai/chat 404，10 小时前 T9 时代镜像不含 T11 ai 域），已重建 frontend（完成），backend 卡 mvn 依赖层。

## 2. 关键决策（已拍板，不再重复问）

1. task-triage 走「用户级技能 + 偏好绑定」，不照搬 work 或 tea 规则。
2. AI key 用官方变量名 `AI_DASHSCOPE_API_KEY`，compose 默认 `:-disabled`（无 key 可部署，降级链保留）。
3. M1 之后观测/预算 = M2 输入（本期不做）。
4. 镜像落后于源码属必须修复项：重建后全栈冒烟。

## 3. 阻塞与待续（新对话第一步从这里开始）

- backend 镜像重建**未确认完成**：日志 `C:\Users\yanha\Desktop\tea\build-backend.log`（最后状态：`#11 [builder 4/6] RUN mvn -q dependency:go-offline` 卡住，pom 因 T11 加 dashscope starter 缓存失效，全量重拉依赖；build-frontend.log 已 Build 完成）。
- 若 build-backend.log 无 `EXIT=0`：等待完成或查代理/网络（宿主机到 maven.aliyun.com / repo.maven.apache.org 连通性）。
- backend 容器当前跑的是旧镜像（tea-backend-1 Up，含 tea 域无 ai 域）。

## 4. 未提交改动（git status：main 分支，3 个 M 文件）

| 文件 | 改动 |
|---|---|
| docker-compose.yml | backend environment 加 `AI_DASHSCOPE_API_KEY: ${AI_DASHSCOPE_API_KEY:-disabled}` |
| .env.example | Spring Boot 新栈段加 AI_DASHSCOPE_API_KEY 条目（可选） |
| DEPLOY.md | 0.2 首次部署加 AI key 可选说明 |

## 5. 新对话待办（精确顺序）

1. 确认 backend 镜像重建完成（build-backend.log 尾 + `docker compose build backend` 若需重跑）。
2. `docker compose up -d backend`（新镜像）→ 全栈冒烟：
   - GET /actuator/health → UP
   - GET /api/v1/teas → 200 + V2 种子
   - POST /api/v1/auth/register+login 拿 token → POST /api/v1/ai/chat（无 key）→ 502 降级路径
   - GET /api/v1/culture/search → 200
3. `docker compose up -d frontend`（新镜像）→ 经 nginx 80 冒烟：http://localhost/api/v1/teas、http://localhost/ 首页。
4. 清理临时文件：build-backend.log、build-frontend.log、$env:TEMP\reg.json、$env:TEMP\ai.json。
5. 提交三文件（git status 当前 main 未提交；建议 fix/m1-ai-key-wiring 分支或按 M1 惯例 feature 分支 → commit → 合 main → push）。
6. M1 整体评估复盘（可作 M2 规划输入：观测/预算、全栈回归、部署）。

## 6. 环境陷阱（避免踩坑）

- 无 Bash：Windows 主机，一切走 PowerShell。
- PowerShell 向 curl 传 JSON：引号会被破坏 → 用 `Set-Content -Path file -Value json -Encoding utf8 -NoNewline` + `curl --data-binary "@file"`。
- `Invoke-WebRequest .Content` 可能返回字节数组：用 curl.exe -w '%{http_code}'。
- 容器内代理：Docker daemon 配置会注入 http_proxy（backend healthcheck 注释已说明，-Y off 直连）。
- 本地数据库：db 容器 5432 不暴露宿主；application-dev.yml 指向宿主 5433（tea-postgres 容器）。
- 承重墙密码提示（历史）：compose db 卷密码若认证失败，先试候选已知密码（历史 .env 值），重建卷是最后手段。

## 7. 产物清单（昨天产出路径）

- `.user_skills/task-triage/SKILL.md`（v4 最终版，用户级技能）
- `C:\Users\yanha\Desktop\tea\.harness\skills\main-dev\caveman-review\SKILL.md` + `docs/skills/caveman-review.md`（已提交 b3e5b1e）
- 未提交三文件：docker-compose.yml / .env.example / DEPLOY.md
- 临时日志：build-backend.log / build-frontend.log（待清理）
- T11 批次（已合 main）：backend ai/culture 域 + 前端 teaAI 切 v1 + 契约登记 + changes 三件套

## 8. 关键路径速查

- task-triage 技能：`C:\Users\yanha\AppData\Local\Doubao\User Data\Profile 2\.doubao\agent_mode\workspace\.user_skills\task-triage\SKILL.md`
- 流程规范：`C:\Users\yanha\Desktop\tea\.harness\rules\开发流程规范.md`（十阶段流水线）
- work 学习材料：`C:\Users\yanha\Desktop\work\AGENTS.md` + `AGENTS-details.md` + `career-os\skills\SKILL_INDEX.md` + `update-skills.ps1`
- 用户偏好：8 条激活（ASD-STE100 / task-triage 分诊 / token 按需加载 / harness 治理等）
