# 「一盏茶」生产部署

> **生产服务器（当前）**：阿里云 ECS **Linux**，部署目录 **`/opt/tea-ceremony-main`**（git clone 或 GitHub zip 解压，非 git 仓库时无法 `git pull`），Docker Compose 编排（db/backend/frontend + yg-gateway 评测实例）。
>
> **两套部署方式并存（按后端栈选择）**：
> - **Spring Boot 新栈（当前生产，唯一推荐）**：Docker Compose 编排（db/backend/frontend 三服务 + nginx 反代），见下节「〇、Spring Boot 新栈：Docker Compose 部署」。
> - **旧 FastAPI 栈（仅历史参考，已不部署）**：PostgreSQL Windows 服务 + Python venv + NSSM + uvicorn + nginx for Windows，见「一~九」节（旧脚本 `scripts/deploy-backend.ps1` 等保留，不再新增功能）。**2026-10-14 起生产实际为 Linux Compose 栈，以下 Windows 章节不再适用**。
>
> 历史背景：旧栈时代 Docker 方案曾被弃用（`docker-compose.yml`、`backend/Dockerfile`、`nginx/Dockerfile` 保留作参考）；后端重写为 Spring Boot 后恢复 Compose 编排为主路径（AGENTS.md §11）。

---

## 〇、Spring Boot 新栈：Docker Compose 部署（推荐）

### 0.1 前置

- Docker + Docker Compose v2（Linux 服务器：dnf 装 docker-ce + compose 插件）。
- 服务器放行 80（前端）、8080（可选直连后端）。

### 0.2 首次部署（Linux）

```bash
cd /opt
# 1. 拉代码（zip 解压版目录非 git 仓库时，用 git clone 同步：
#    git clone --depth 1 https://github.com/qiuqianyi66/tea-ceremony.git tea-sync
#    \cp -af /tmp/tea-sync/. /opt/tea-ceremony-main/    # \cp 绕过 alias cp -i 的逐个询问
#    注意：目标目录 .env / yg-gateway-secrets-main 等 zip/clone 之外的文件不会被覆盖）
git clone https://github.com/qiuqianyi66/tea-ceremony.git tea-ceremony-main

# 2. 准备 .env（从 .env.example 复制；必填四键）
cp .env.example .env
#    DB_PASSWORD / JWT_SECRET 必须改成强随机值（JWT_SECRET 生成：python3 -c "import secrets;print(secrets.token_hex(32))"）
#    AI_GATEWAY_API_KEY 必填（2026-10-14 用户拍板：生产 AI 走 yg-gateway 网关通道，缺失时 backend 启动失败）
#    AI_DASHSCOPE_API_KEY 可留（DashScope 备用通道，移除 gateway 配置即可切回）
#    注意：compose 用 ${DB_PASSWORD:?} / ${JWT_SECRET:?} / ${AI_GATEWAY_API_KEY:?} 强制，缺失直接启动失败（预期安全行为）

# 3. 起全套（db 就绪 → backend Flyway 迁移 → frontend 依赖 backend 健康）
docker compose up -d --build

# 4. 验证
docker compose ps          # 三服务均 healthy
curl -s http://localhost:18080/actuator/health          # 后端存活（宿主映射 18080）
curl -s http://localhost/api/v1/teas                     # 匿名可读：200 + V2 文化种子
```

### 0.3 架构与数据

- 服务：`db`（pgvector/pgvector:pg16，**不暴露宿主端口**，仅容器网络）/ `backend`（Spring Boot 8080，宿主映射 **18080**，Flyway 自动迁移）/ `frontend`（nginx 80，多阶段镜像内含 vite 构建产物 + brotli，`/api/` 反代 backend:8080）/ `yg-gateway`（AI 网关，DeepSeek 账号池，仅 compose 网络内部访问，不映射宿主端口）。
- schema 完全由 Flyway 管理；**旧 `database/init.sql` 已从编排移除**（预建表与 Flyway 冲突）。
- 数据持久化：`pgdata` 卷；`docker compose down` 不丢数据；备份 `docker compose exec -T db pg_dump -U tea_user tea_ceremony > backup.sql`。
- 健康检查：backend 用 Actuator `/actuator/health`（JRE-alpine busybox wget）。
- **AI 通道（2026-10-14 用户拍板）**：生产 backend 走 **yg-gateway**（`SPRING_PROFILES_ACTIVE: gateway` + `AI_GATEWAY_*`，openai 兼容 → DeepSeek）；DashScope 备用（保留 `AI_DASHSCOPE_API_KEY`，移除 gateway 配置即切回）。**`AI_GATEWAY_API_KEY` 用 `:?` 强制**（2026-10-13 教训：空 key → OpenAiApi 装配失败 → backend 起不来）。网关不可用时后端 502 → 前端降级规则引擎（teaAI.ts 承重墙）。yg-gateway 源码/config/auths 在 `./yg-gateway/`（本地目录，不入 GitHub；服务器单独部署）。

### 0.4 日常维护（Linux）

```bash
docker compose logs -f backend        # 后端日志（Flyway/启动错误看这里）
docker compose build backend && docker compose up -d backend   # 代码更新：重建 + 重启
docker compose down                   # 停（保留数据卷）
docker compose down -v                # 停并删数据卷（谨慎：清空数据库）
```

> 代码更新同步：目录非 git 仓库时按 0.2 第 1 步 git clone 覆盖；Maven Central 偶发 500（`dependency:go-offline` 失败）时重试 build，仍失败则改 pom 加阿里云 Maven 镜像。

### 0.5 HTTPS

证书就绪后：取消 `nginx.conf` 443 server block 注释 + `docker compose.yml` frontend 的 `443:443` 映射注释，证书挂载到 `/etc/nginx/certs/`（详见旧栈「七」节 HTTPS 要点，配置结构一致）。

---

## 一、服务器准备（首次，约 30 分钟）

### 1. 装 PostgreSQL 17（EDB 官方安装器）

1. 下载：<https://www.postgresql.org/download/windows/> 选 Windows x86-64，运行 EDB 安装器。
2. 安装目录默认 `C:\Program Files\PostgreSQL\17`；**记住安装时设的 postgres 超级用户密码**。
3. 安装器会自动把 `postgresql-x64-17` 注册成 Windows 服务并开机自启。
4. 建业务库和用户（用管理员 PowerShell，或 pgAdmin）：

```powershell
$env:PGPASSWORD = 'postgres超管密码'
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -c "CREATE USER tea_user WITH PASSWORD '换成强密码';"
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -c "CREATE DATABASE tea_ceremony OWNER tea_user;"
```

### 2. 装 Python 3.12（版本钉死，必须 3.12.x）

```powershell
winget install Python.Python.3.12
# 新开一个 PowerShell 让 PATH 生效
python --version   # 应显示 Python 3.12.x
```

> 版本不对部署脚本会直接报错停止（`.python-version` 声明 3.12）。Windows 装错 Python 版本是部署第一大坑，故强制校验。

### 3. 装 NSSM（托管后端进程）

1. 下载：<https://nssm.cc/download>，解压后取 `win64\nssm.exe`，放到 `C:\Windows\System32\`（进 PATH）。
2. 验证：`nssm version`。

### 4. 装 nginx for Windows

1. 下载稳定版：<https://nginx.org/en/download.html>（Stable version 的 Windows zip）。
2. 解压到 `C:\nginx`（路径无空格）。
3. 验证：`cd C:\nginx; start nginx`，浏览器访问 `http://127.0.0.1` 看到 welcome 页即成功；`nginx -s stop` 停掉。
4. 阿里云安全组放行 80、443（在控制台配置，来源 0.0.0.0/0）。

### 5. 装 Git 并拉代码

```powershell
winget install Git.Git
cd C:\
git clone https://github.com/你的仓库/tea.git
cd C:\tea
```

---

## 二、后端部署（一条命令）

### 1. 配置 `.env`

在 `C:\tea\backend\` 放 `.env`（从仓库根 `.env.example` 复制后改）。**生产关键项**：

```env
# 必填：openssl rand -hex 32 等价（PowerShell: python -c "import secrets;print(secrets.token_hex(32))"）
SECRET_KEY=随机64位hex
DATABASE_URL=postgresql://tea_user:刚才的密码@localhost:5432/tea_ceremony
DEV_MODE=false
# 生产放行实际域名/IP；不要用 *
ALLOWED_HOSTS=42.121.125.4,你的域名.com
# 留空 = 进程内存限流（单实例推荐）
REDIS_URL=
# AI 代理（DeepSeek）
AI_PROXY_KEY=sk-你的key
```

> 规则：`.env` 永不入库、永不回显密钥；只读不写时用 `Get-Content`，写入用整行替换。

### 2. 跑一键部署脚本

以**管理员** PowerShell 运行（脚本会校验 Python 3.12 → 建 venv → 按 `requirements.lock` 全量锁定安装依赖 → `alembic upgrade head` → 注册/重启 `tea-backend` 服务 → `/live` 健康断言）：

```powershell
cd C:\tea
.\scripts\deploy-backend.ps1
```

项目不在 `C:\tea` 或端口不同：

```powershell
.\scripts\deploy-backend.ps1 -ProjectRoot D:\tea -Port 8000
# 只校验不执行：
.\scripts\deploy-backend.ps1 -DryRun
```

脚本幂等可重跑：服务已存在则只重启，不存在才注册。首装后可选补种子数据：

```powershell
cd C:\tea\backend
.\.venv\Scripts\python -m seeds.run
```

---

## 三、配置前端

### 1. 装 Node 并构建

```powershell
winget install OpenJS.NodeJS.LTS
cd C:\tea
npm ci
npm run build    # 产物在 C:\tea\dist
```

### 2. 配置 nginx

把仓库根的 `nginx-windows.conf` 内容合并进 `C:\nginx\conf\nginx.conf`（替换默认 `server {}` 块）。
若项目不在 `C:\tea`，把配置里的 `root C:/tea/dist` 改成实际路径。

校验并启动：

```powershell
cd C:\nginx
.\nginx.exe -t          # 校验配置
start nginx             # 后台启动
# 以后配成开机自启（见下方「nginx 开机自启」）
```

### 3. nginx 开机自启（可选但推荐）

nginx 本身不是服务。用 NSSM 把它也注册成服务：

```powershell
nssm install tea-nginx C:\nginx\nginx.exe
nssm set tea-nginx AppDirectory C:\nginx
nssm set tea-nginx AppStdout C:\tea\logs\nginx-out.log
nssm set tea-nginx AppStderr C:\tea\logs\nginx-err.log
nssm set tea-nginx Start SERVICE_AUTO_START
nssm set tea-nginx AppExit Default Restart
Start-Service tea-nginx
```

---

## 四、访问与验证

- 前端：`https://42.121.125.4`（nginx 443 端口，HTTP/2）
- API：`https://42.121.125.4/api/`（经 443 → 容器 80 → backend:8080）
- API 文档：`https://42.121.125.4/api/docs`
- 后端存活探针：`http://127.0.0.1:8000/live`（在服务器本机访问；公网走 nginx）

健康自检：

```powershell
# 后端存活（不查 DB）
Invoke-RestMethod http://127.0.0.1:8000/live
# 后端就绪（查 DB，DB 挂了返回 503）
Invoke-RestMethod http://127.0.0.1:8000/ready
# 前端
Invoke-WebRequest http://127.0.0.1 | Select-Object StatusCode
```

---

## 五、日常维护

### 升级代码（一条命令）

```powershell
cd C:\tea
.\scripts\update-backend.ps1          # 后端：pull → 依赖 → 迁移 → 重启 → /live
.\scripts\update-backend.ps1 -BuildFrontend   # 前端有变更时一起重建
```

脚本会先检查工作区有没有未提交改动（有则中止，防止 pull 冲突），全程幂等；重大 schema 变更前建议先停服务：

```powershell
Stop-Service tea-backend ; .\scripts\update-backend.ps1 ; Start-Service tea-backend
```

### 日志 / 重启 / 停止

```powershell
Get-Content C:\tea\logs\backend-out.log -Wait -Tail 50
Get-Content C:\tea\logs\backend-err.log -Wait -Tail 50
Restart-Service tea-backend
Stop-Service  tea-backend
Restart-Service tea-nginx   # 如果注册了 nginx 服务
```

### 数据库备份（Windows 任务计划每日）

手动备份一次：

```powershell
$env:PGPASSWORD = 'tea_user密码'
$bak = "C:\tea\backups\tea-$(Get-Date -Format yyyyMMdd).sql"
New-Item -ItemType Directory -Force C:\tea\backups | Out-Null
& "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe" -U tea_user -d tea_ceremony -f $bak
```

恢复到空库：

```powershell
$env:PGPASSWORD = 'tea_user密码'
Get-Content $bak | & "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U tea_user -d tea_ceremony
```

每日自动备份：以管理员打开「任务计划程序」→ 创建任务 →
- 触发器：每天凌晨 3 点
- 操作：启动程序 `powershell.exe`，参数 `-File C:\tea\scripts\backup-postgres.ps1`（脚本含保留最近 14 份的清理逻辑）

---

## 六、依赖锁定维护（改依赖时必读）

后端依赖**双层锁定**，重建环境不会漂移：

- `requirements.txt` / `requirements-dev.txt` —— 顶层声明（人工维护，精确 `==`）
- `requirements.lock` / `requirements-dev.lock` —— **全量锁定**（pip-tools 生成，含所有传递依赖；CI 与部署脚本都从这里安装）

升级/新增依赖流程：

```powershell
# 1. 改顶层声明（requirements*.txt）
# 2. 重新生成全量锁（务必带两个 --no-emit-*，防止本机 pip 镜像配置写进 lock 入库）
cd C:\tea\backend
.\.venv\Scripts\pip install pip-tools
.\.venv\Scripts\python -m piptools compile --no-emit-index-url --no-emit-trusted-host --output-file requirements.lock requirements.txt
.\.venv\Scripts\python -m piptools compile --no-emit-index-url --no-emit-trusted-host --output-file requirements-dev.lock requirements-dev.txt
# 3. 本地按 lock 重装并验证
.\.venv\Scripts\pip install -r requirements.lock
.\.venv\Scripts\python -m pytest tests -q
```

> 规则：lock 文件不得包含 `--index-url` / `--trusted-host` 等机器私有配置；重新生成后检查文件头部，有残留就删掉再提交。

---

## 七、生产安全配置

- **CORS**：生产走 nginx 同源反代 `/api`，无需额外跨域。
- **限流**：`.env` 调 `RATE_LIMIT_MAX` / `RATE_LIMIT_LOGIN_MAX` / `RATE_LIMIT_AI_MAX`；单实例进程内存实现。
- **AI 代理**：浏览器不直连 LLM，统一走后端 `/api/ai/*`；在 `.env` 配 `AI_PROXY_KEY`，未配时前端自动降级本地规则引擎。
- **错误格式**：统一 `{ "detail": ..., "code": ..., "status": ... }`。
- **安全头**：nginx 配置已带 CSP / X-Frame-Options / nosniff 等，见 `nginx-windows.conf`。

---

## 八、域名和 HTTPS

1. 域名解析到 `42.121.125.4`。
2. 申请证书（Let's Encrypt 或阿里云免费 SSL），得到 `fullchain.pem`、`privkey.pem`，放到 `C:\tea\certs\`。
3. 编辑 `C:\nginx\conf\nginx.conf`，取消末尾 443 server block 的注释，把 `server_name _` 改成你的域名。
4. 阿里云安全组放行 443。
5. 校验并重载：
   ```powershell
   cd C:\nginx; .\nginx.exe -t; .\nginx.exe -s reload
   ```
6. 如需 80→443 强制跳转，取消 443 block 内 `if ($scheme = http)` 那行注释。

---

## 九、从旧 Docker 方案迁移（如已在跑容器）

如果之前用 Docker Compose 部署过：

1. **先停容器并备份数据**：
   ```powershell
   cd C:\tea
   docker compose exec -T db pg_dump -U tea_user tea_ceremony > pre-migration.sql
   docker compose down
   ```
2. 按本文档第一~四节装好原生组件。
3. 还原数据到新装的本地 PostgreSQL：
   ```powershell
   $env:PGPASSWORD = 'tea_user密码'
   Get-Content C:\tea\pre-migration.sql | & "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U tea_user -d tea_ceremony
   ```
4. 验证后端 `/ready` 返回 DB ok 后，再切 nginx 到原生配置。
5. 确认无问题后，旧 Docker 文件保留作历史参考，不删。

## HTTPS（裸 IP 证书，2026-10-18 上线）

站点跑在裸 IP `42.121.125.4` 上，**无域名、无 ICP 备案**，用 Let's Encrypt 的 `shortlived` profile 签发 **IP 证书**。

| 项 | 值 |
|---|---|
| 证书 | Let's Encrypt，SAN = `IP Address:42.121.125.4` |
| 有效期 | **160 小时（≈6.7 天）**，必须自动续期 |
| 端口 | 80（保留给 ACME 续期）+ 443（HTTP/2） |

### 部署形态

frontend 容器**零挂载**时 nginx.conf 打在镜像里，改宿主机文件不生效。故 compose 里加两个挂载：

```yaml
  frontend:
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
      - ./certs:/etc/nginx/certs:ro
```

nginx.conf 的 443 server 块原本是注释状态（`# server {` 起），上线时 `sed -i '70,123s/^#//'` 放开，并把 `server_name localhost` 改为 `_`（否则匹配不到用 IP 访问的请求）。

### 续期（renew-cert.sh）

standalone 模式需要 80 端口，而 nginx 正占着它 → **续期必须临时停站**（约 30 秒）。

```bash
#!/bin/bash
set -e
cd /opt/tea-ceremony-main
docker compose stop frontend
sleep 3
/root/.acme.sh/acme.sh --cron --home /root/.acme.sh
docker compose start frontend
sleep 2
curl -sfI http://42.121.125.4 > /dev/null && echo "site OK" || echo "SITE DOWN - CHECK"
```

cron（每 2 天跑一次，远早于 6.7 天过期）：

```
17 4 */2 * * /opt/tea-ceremony-main/renew-cert.sh >> /var/log/renew-cert.log 2>&1
```

reloadcmd 必须写成「先确保容器起来了再 reload」，否则停站续期时容器还没起，reload 会失败：

```bash
acme.sh --install-cert -d 42.121.125.4 --ecc \
  --key-file       /opt/tea-ceremony-main/certs/privkey.pem \
  --fullchain-file /opt/tea-ceremony-main/certs/fullchain.pem \
  --reloadcmd "cd /opt/tea-ceremony-main && docker compose start frontend >/dev/null 2>&1; docker compose exec -T frontend nginx -s reload"
```

### 回滚

```bash
cd /opt/tea-ceremony-main
cp nginx.conf.bak-https nginx.conf
cp docker-compose.yml.bak-https docker-compose.yml
docker compose up -d frontend
```

### 已知噪声（无害）

nginx reload 时会打印 `duplicate MIME type "text/html"` 警告 —— nginx 镜像自带 mime.types 里 text/html 被重复声明，与本次改动无关，不影响服务。
