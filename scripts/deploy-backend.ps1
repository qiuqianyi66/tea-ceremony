<#
.SYNOPSIS
  一键部署/重装「一盏茶」后端（Windows 原生，非 Docker）。

.DESCRIPTION
  把原手工步骤（建 venv → 装依赖 → 迁移 → 注册服务 → 健康检查）收敛为一条命令，幂等可重跑：
  1. 校验 Python 版本（必须 3.12.x）
  2. 建/复用 backend\.venv
  3. 按 requirements.lock 安装依赖（全量锁定，杜绝环境漂移）
  4. alembic upgrade head（数据库迁移）
  5. 服务 tea-backend 已存在则重启；不存在则调用 install-windows-service.ps1 注册
  6. 请求 /live 断言健康

.PARAMETER ProjectRoot
  项目根目录，默认取本脚本上一级。

.PARAMETER Port
  后端监听端口，默认 8000。

.PARAMETER PythonExe
  本机 Python 解释器，默认 python（也可传 py -3.12 或全路径）。

.PARAMETER DryRun
  只做只读校验并打印将执行的命令，不实际安装/迁移/改服务。

.EXAMPLE
  .\scripts\deploy-backend.ps1
  .\scripts\deploy-backend.ps1 -ProjectRoot D:\tea -DryRun
#>
param(
    [string]$ProjectRoot = "",
    [int]$Port = 8000,
    [string]$PythonExe = "python",
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$ServiceName = "tea-backend"

if (-not $ProjectRoot) {
    $ProjectRoot = Split-Path $PSScriptRoot -Parent
}
$BackendDir = Join-Path $ProjectRoot "backend"
$VenvDir    = Join-Path $BackendDir ".venv"
$VenvPip    = Join-Path $VenvDir "Scripts\pip.exe"
$VenvPython = Join-Path $VenvDir "Scripts\python.exe"
$VenvAlembic = Join-Path $VenvDir "Scripts\alembic.exe"
$InstallScript = Join-Path $ProjectRoot "scripts\install-windows-service.ps1"
$LockFile   = Join-Path $BackendDir "requirements.lock"

Write-Host "=== 一盏茶后端一键部署 ===" -ForegroundColor Cyan
Write-Host "项目根:  $ProjectRoot"
Write-Host "监听:    127.0.0.1:$Port"
if ($DryRun) { Write-Host "模式:    DRY RUN（只校验不执行）" -ForegroundColor Yellow }

# --- 1. 前置校验（DryRun 同样执行） ---
Write-Host "`n[1/6] 校验环境..." -ForegroundColor Cyan
if (-not (Test-Path $BackendDir)) { Write-Error "找不到 $BackendDir，请确认 -ProjectRoot 指向项目根。" }
if (-not (Test-Path $LockFile)) { Write-Error "找不到 $LockFile。请先 git pull 拿到最新的 requirements.lock（生成命令见 DEPLOY.md）。" }

$pyVersion = (& $PythonExe --version 2>&1 | Out-String).Trim()
if ($pyVersion -notmatch "^Python 3\.12\.") {
    Write-Error "Python 版本校验失败：$pyVersion。部署要求 Python 3.12.x（.python-version）。可用 -PythonExe 'py -3.12' 指定，或 winget install Python.Python.3.12。"
}
Write-Host "  Python:  $pyVersion" -ForegroundColor Green

if (-not (Test-Path (Join-Path $BackendDir ".env"))) {
    Write-Warning "  $BackendDir\.env 不存在。部署会继续，但生产必须配好 .env 再上线（模板见仓库根 .env.example）。"
} else {
    Write-Host "  .env:    已存在" -ForegroundColor Green
    # SECRET_KEY 强度预检：<32 字符时 uvicorn 启动即崩（main.py 校验），这里提前拦截（不回显密钥值）
    $secretLine = Get-Content (Join-Path $BackendDir ".env") | Where-Object { $_ -match '^\s*SECRET_KEY\s*=' } | Select-Object -First 1
    $secretVal = ($secretLine -replace '^\s*SECRET_KEY\s*=\s*', '').Trim('"').Trim("'")
    if ($secretVal.Length -lt 32) {
        Write-Error "backend\.env 的 SECRET_KEY 强度不足（当前 $($secretVal.Length) 字符，要求 ≥32）。生成：python -c ""import secrets; print(secrets.token_hex(32))""，然后整行替换 .env 中的 SECRET_KEY。"
    }
    Write-Host "  SECRET_KEY: 强度校验通过" -ForegroundColor Green
}

# --- 2. venv ---
Write-Host "[2/6] 虚拟环境..." -ForegroundColor Cyan
if (Test-Path $VenvPython) {
    Write-Host "  $VenvDir 已存在，复用。" -ForegroundColor Green
} else {
    Write-Host "  创建 $VenvDir ..."
    if (-not $DryRun) {
        & $PythonExe -m venv $VenvDir
        if ($LASTEXITCODE -ne 0) { Write-Error "python -m venv 失败。" }
    } else {
        Write-Host "  [DRY] python -m venv $VenvDir"
    }
}

# --- 3. 依赖（全量锁） ---
Write-Host "[3/6] 安装依赖（requirements.lock 全量锁定）..." -ForegroundColor Cyan
if (-not $DryRun) {
    & $VenvPip install --upgrade pip
    & $VenvPip install -r $LockFile
    if ($LASTEXITCODE -ne 0) { Write-Error "依赖安装失败。" }
    Write-Host "  依赖安装完成。" -ForegroundColor Green
} else {
    Write-Host "  [DRY] $VenvPip install --upgrade pip"
    Write-Host "  [DRY] $VenvPip install -r $LockFile"
}

# --- 4. 数据库迁移 ---
Write-Host "[4/6] 数据库迁移（alembic upgrade head）..." -ForegroundColor Cyan
if (-not $DryRun) {
    Push-Location $BackendDir
    try {
        & $VenvAlembic upgrade head
        if ($LASTEXITCODE -ne 0) { Write-Error "alembic upgrade head 失败，请检查 .env 的 DATABASE_URL。" }
    } finally {
        Pop-Location
    }
    Write-Host "  迁移完成。" -ForegroundColor Green
} else {
    Write-Host "  [DRY] cd backend; $VenvAlembic upgrade head"
}

# --- 5. 服务（重启或注册） ---
Write-Host "[5/6] Windows 服务..." -ForegroundColor Cyan
$svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
if ($svc) {
    Write-Host "  服务 $ServiceName 已存在，重启..."
    if (-not $DryRun) {
        Restart-Service $ServiceName -Force
        Write-Host "  已重启。" -ForegroundColor Green
    } else {
        Write-Host "  [DRY] Restart-Service $ServiceName"
    }
} else {
    Write-Host "  服务 $ServiceName 不存在，调用 install-windows-service.ps1 注册..."
    if ($DryRun) {
        Write-Host "  [DRY] & $InstallScript -ProjectRoot $ProjectRoot -Port $Port（需管理员）"
    } else {
        $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
        if (-not $isAdmin) { Write-Error "注册服务需要管理员权限：请用管理员 PowerShell 重跑本脚本（或先手动执行 $InstallScript）。" }
        & $InstallScript -ProjectRoot $ProjectRoot -Port $Port
        if ($LASTEXITCODE -ne 0) { Write-Error "服务注册失败。" }
    }
}

# --- 6. 健康检查 ---
Write-Host "[6/6] 健康检查..." -ForegroundColor Cyan
if (-not $DryRun) {
    try {
        $live = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/live" -TimeoutSec 8
        Write-Host "  /live => $($live | ConvertTo-Json -Compress)" -ForegroundColor Green
        Write-Host "`n部署完成。" -ForegroundColor Green
    } catch {
        Write-Warning "  /live 未响应：$($_.Exception.Message)。查看 $ProjectRoot\logs\backend-err.log 排查。"
        exit 1
    }
} else {
    Write-Host "  [DRY] Invoke-RestMethod http://127.0.0.1:$Port/live"
    Write-Host "`nDRY RUN 结束：校验通过，以上命令将在真实执行时运行。" -ForegroundColor Yellow
}
