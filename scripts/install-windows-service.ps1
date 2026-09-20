<#
.SYNOPSIS
  用 NSSM 把「一盏茶」后端（uvicorn）注册成 Windows 服务。

.DESCRIPTION
  Windows Server 原生部署版：替代原来的 Docker backend 容器。
  - 单进程 uvicorn（gunicorn 不支持 Windows，单用户不需要多 worker）
  - 开机自启、崩溃自动重启
  - stdout/stderr 落盘到 logs\backend-out.log / backend-err.log（按大小轮转）
  - 环境变量由 backend\.env 自行加载（config.py 已 load_dotenv）

.PREREQUISITES
  1. 以管理员身份运行 PowerShell
  2. 已装 NSSM（https://nssm.cc/download 解压后把 nssm.exe 放到 PATH，如 C:\Windows\System32\）
  3. 项目已 clone 到 $ProjectRoot，且 backend\.venv 已建好、依赖已装
  4. PostgreSQL 已装并在跑，.env 里 DATABASE_URL 指向 localhost:5432

.PARAMETER ProjectRoot
  项目根目录，默认 C:\tea

.PARAMETER Port
  后端监听端口，默认 8000

.EXAMPLE
  .\scripts\install-windows-service.ps1
  .\scripts\install-windows-service.ps1 -ProjectRoot D:\tea -Port 8000
#>

#Requires -RunAsAdministrator
param(
    [string]$ProjectRoot = "C:\tea",
    [int]$Port = 8000
)

$ErrorActionPreference = "Stop"
$ServiceName = "tea-backend"
$BackendDir  = Join-Path $ProjectRoot "backend"
$VenvPython  = Join-Path $BackendDir ".venv\Scripts\python.exe"
$VenvUvicorn = Join-Path $BackendDir ".venv\Scripts\uvicorn.exe"
$LogDir      = Join-Path $ProjectRoot "logs"

Write-Host "=== 一盏茶后端 Windows 服务注册 ===" -ForegroundColor Cyan
Write-Host "项目根: $ProjectRoot"
Write-Host "监听:   127.0.0.1:$Port"

# --- 前置检查 ---
if (-not (Get-Command nssm -ErrorAction SilentlyContinue)) {
    Write-Error "未找到 nssm.exe。请从 https://nssm.cc/download 下载，解压后把 nssm.exe 放到 PATH（如 C:\Windows\System32\）再重跑。"
}
if (-not (Test-Path $VenvUvicorn)) {
    Write-Error "未找到 $VenvUvicorn 。请先在 $BackendDir 建好 venv 并装依赖：`n  python -m venv .venv`n  .\.venv\Scripts\pip install -r requirements.txt"
}
if (-not (Test-Path (Join-Path $BackendDir ".env"))) {
    Write-Warning "$BackendDir\.env 不存在。后端会用环境变量默认值，生产请务必配置。"
}
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

# --- 幂等：已存在则先停再删 ---
$existing = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "服务 $ServiceName 已存在，先停止并移除..." -ForegroundColor Yellow
    if ($existing.Status -eq 'Running') { Stop-Service $ServiceName -Force }
    & nssm remove $ServiceName confirm | Out-Null
}

# --- 注册服务 ---
# 用 uvicorn.exe 直接启动（Windows 不支持 gunicorn 的 fork）
# --forwarded-allow-ips=127.0.0.1：nginx 在本机，信任它转来的 XFF
& nssm install $ServiceName $VenvUvicorn "main:app --host 127.0.0.1 --port $Port --forwarded-allow-ips 127.0.0.1" | Out-Null
if ($LASTEXITCODE -ne 0) { Write-Error "nssm install 失败" }

# 工作目录必须是 backend（main.py 在那里）
& nssm set $ServiceName AppDirectory $BackendDir | Out-Null

# 日志：stdout/stderr 落盘 + 轮转（单文件 10MB，留 5 份）
& nssm set $ServiceName AppStdout (Join-Path $LogDir "backend-out.log") | Out-Null
& nssm set $ServiceName AppStderr (Join-Path $LogDir "backend-err.log") | Out-Null
& nssm set $ServiceName AppRotateFiles 1 | Out-Null
& nssm set $ServiceName AppRotateBytes 10485760 | Out-Null
& nssm set $ServiceName AppRotateOnline 1 | Out-Null

# 崩溃自动重启（等价 Docker 的 restart: unless-stopped）
& nssm set $ServiceName Start SERVICE_AUTO_START | Out-Null
& nssm set $ServiceName AppExit Default Restart | Out-Null
& nssm set $ServiceName AppRestartDelay 5000 | Out-Null

# --- 启动 ---
Write-Host "启动服务..." -ForegroundColor Cyan
Start-Service $ServiceName
Start-Sleep -Seconds 3

# --- 验证 ---
$svc = Get-Service $ServiceName
Write-Host ""
Write-Host "服务状态: $($svc.Status)" -ForegroundColor Green
Write-Host "日志目录: $LogDir"
Write-Host ""
Write-Host "验证后端健康：" -ForegroundColor Cyan
try {
    $live = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/live" -TimeoutSec 5
    Write-Host "  /live => $($live | ConvertTo-Json -Compress)" -ForegroundColor Green
} catch {
    Write-Warning "  /live 未响应：$($_.Exception.Message)。查看 $LogDir\backend-err.log 排查。"
}
Write-Host ""
Write-Host "完成。常用命令：" -ForegroundColor Cyan
Write-Host "  查看日志:   Get-Content $LogDir\backend-out.log -Wait -Tail 50"
Write-Host "  重启服务:   Restart-Service $ServiceName"
Write-Host "  停止服务:   Stop-Service $ServiceName"
Write-Host "  升级代码:   cd $ProjectRoot; git pull; cd backend; .\.venv\Scripts\alembic upgrade head; Restart-Service $ServiceName"
