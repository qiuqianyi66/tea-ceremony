# 「一盏茶」生产部署（Windows Server 原生，无 Docker）

> 服务器：阿里云 ECS，Windows Server 2022，2 核 2G，40GB
> 方案：PostgreSQL 安装成 Windows 服务 + Python venv + NSSM 托管 uvicorn + nginx for Windows 静态/反代。
> **已弃用 Docker**：`docker-compose.yml`、`backend/Dockerfile`、`nginx/Dockerfile` 保留作历史参考，不再用于部署。
> 为什么不用 gunicorn：gunicorn 官方只支持 Unix（依赖 fork/fcntl）；Windows 上直接用 uvicorn 单进程，单用户 2 核够用。
> 为什么不用 Redis：单实例走进程内存限流（代码已支持 `REDIS_URL` 留空自动降级），少一个服务。

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

### 2. 装 Python 3.12

```powershell
winget install Python.Python.3.12
# 新开一个 PowerShell 让 PATH 生效
python --version   # 应显示 Python 3.12.x
```

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

## 二、配置后端

### 1. 建 venv 并装依赖

```powershell
cd C:\tea\backend
python -m venv .venv
.\.venv\Scripts\python -m pip install --upgrade pip
.\.venv\Scripts\pip install -r requirements.txt
```

### 2. 配置 `.env`

在 `C:\tea\backend\` 放 `.env`（从仓库根 `.env.example` 复制后改）。**生产关键项**：

```env
# 必填：openssl rand -hex 32 等价（PowerShell: python -c "import secrets;print(secrets.token_hex(32))"）
SECRET_KEY=随机64位hex
DATABASE_URL=postgresql://tea_user:刚才的密码@localhost:5432/tea_ceremony
DEV_MODE=false
# 生产放行实际域名/IP；不要用 *
ALLOWED_HOSTS=120.26.49.122,你的域名.com
# 留空 = 进程内存限流（单实例推荐）
REDIS_URL=
# AI 代理（DeepSeek）
AI_PROXY_KEY=sk-你的key
```

> 规则：`.env` 永不入库、永不回显密钥；只读不写时用 `Get-Content`，写入用整行替换。

### 3. 跑数据库迁移 + 种子数据

```powershell
cd C:\tea\backend
.\.venv\Scripts\alembic upgrade head
.\.venv\Scripts\python -m seeds.run
```

### 4. 注册成 Windows 服务

以**管理员** PowerShell 运行项目自带脚本：

```powershell
cd C:\tea
.\scripts\install-windows-service.ps1
```

脚本会：
- 用 NSSM 注册 `tea-backend` 服务（uvicorn 单进程，监听 127.0.0.1:8000）
- 设为开机自启、崩溃 5 秒后自动重启
- stdout/stderr 落到 `C:\tea\logs\backend-out.log` / `backend-err.log`（10MB 轮转）
- 启动后自动请求 `/live` 验证

如果项目不在 `C:\tea` 或端口不是 8000：

```powershell
.\scripts\install-windows-service.ps1 -ProjectRoot D:\tea -Port 8000
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

- 前端：`http://120.26.49.122`（nginx 80 端口）
- API：`http://120.26.49.122/api/`
- API 文档：`http://120.26.49.122/api/docs`
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

### 日志

```powershell
Get-Content C:\tea\logs\backend-out.log -Wait -Tail 50
Get-Content C:\tea\logs\backend-err.log -Wait -Tail 50
```

### 重启 / 停止

```powershell
Restart-Service tea-backend
Stop-Service  tea-backend
Restart-Service tea-nginx   # 如果注册了 nginx 服务
```

### 升级代码

```powershell
cd C:\tea
git pull
cd C:\tea\backend
.\.venv\Scripts\alembic upgrade head          # 有迁移才跑
cd C:\tea
npm ci ; npm run build                          # 前端有变更才跑
Restart-Service tea-backend
# nginx 不用重启，静态文件直接生效
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
- 操作：启动程序 `powershell.exe`，参数 `-File C:\tea\scripts\backup-postgres.ps1`（把上面 pg_dump 命令存成该 ps1，并加保留最近 14 份的清理逻辑）

---

## 六、生产安全配置

- **CORS**：生产走 nginx 同源反代 `/api`，无需额外跨域。
- **限流**：`.env` 调 `RATE_LIMIT_MAX` / `RATE_LIMIT_LOGIN_MAX` / `RATE_LIMIT_AI_MAX`；单实例进程内存实现。
- **AI 代理**：浏览器不直连 LLM，统一走后端 `/api/ai/*`；在 `.env` 配 `AI_PROXY_KEY`，未配时前端自动降级本地规则引擎。
- **错误格式**：统一 `{ "detail": ..., "code": ..., "status": ... }`。
- **安全头**：nginx 配置已带 CSP / X-Frame-Options / nosniff 等，见 `nginx-windows.conf`。

---

## 七、域名和 HTTPS

1. 域名解析到 `120.26.49.122`。
2. 申请证书（Let's Encrypt 或阿里云免费 SSL），得到 `fullchain.pem`、`privkey.pem`，放到 `C:\tea\certs\`。
3. 编辑 `C:\nginx\conf\nginx.conf`，取消末尾 443 server block 的注释，把 `server_name _` 改成你的域名。
4. 阿里云安全组放行 443。
5. 校验并重载：
   ```powershell
   cd C:\nginx; .\nginx.exe -t; .\nginx.exe -s reload
   ```
6. 如需 80→443 强制跳转，取消 443 block 内 `if ($scheme = http)` 那行注释。

---

## 八、从旧 Docker 方案迁移（如已在跑容器）

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
