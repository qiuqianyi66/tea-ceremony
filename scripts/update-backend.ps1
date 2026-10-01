<#
.SYNOPSIS
  日常升级「一盏茶」后端（Windows 原生，非 Docker）。

.DESCRIPTION
  替代手工四连（git pull → 装依赖 → 迁移 → 重启），一条命令完成：
  1. 检查工作区干净（有未提交改动则中止，避免 pull 冲突）
  2. git pull origin main
  3. 按 requirements.lock 重装依赖（依赖变更时生效）
  4. alembic upgrade head
  5. 重启 tea-backend 服务
  6. /live 健康断言

.PARAMETER ProjectRoot
  项目根目录，默认取本脚本上一级。

.PARAMETER Port
  后端监听端口，默认 8000。

.PARAMETER BuildFrontend
  同时重建前端（npm ci + npm run build）。默认只升后端。

.PARAMETER DryRun
  只打印将执行的命令，不实际执行。

.EXAMPLE
  .\scripts\update-backend.ps1
  .\scripts\update-backend.ps1 -BuildFrontend
  .\scripts\update-backend.ps1 -DryRun
#>
param(
    [string]$ProjectRoot = "",
    [int]$Port = 8000,
    [switch]$BuildFrontend,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$ServiceName = "tea-backend"

if (-not $ProjectRoot) {
    $ProjectRoot = Split-Path $PSScriptRoot -Parent
}
$BackendDir = Join-Path $ProjectRoot "backend"
$VenvPip    = Join-Path $BackendDir ".venv\Scripts\pip.exe"
$VenvAlembic = Join-Path $BackendDir ".venv\Scripts\alembic.exe"
$LockFile   = Join-Path $BackendDir "requirements.lock"

Write-Host "=== 一盏茶后端日常升级 ===" -ForegroundColor Cyan
Write-Host "项目根:  $ProjectRoot"
if ($DryRun) { Write-Host "模式:    DRY RUN（只打印不执行）" -ForegroundColor Yellow }

# --- 1. 工作区检查 ---
Write-Host "`n[1/6] 检查工作区..." -ForegroundColor Cyan
Push-Location $ProjectRoot
try {
    $dirty = @(git status --porcelain)
    if ($dirty.Count -gt 0) {
        Write-Host "  未提交的本地改动："
        $dirty | ForEach-Object { Write-Host "    $_" }
        Write-Error "工作区不干净，中止升级。请先 commit 或 stash（git stash）再重跑。"
    }
    Write-Host "  工作区干净。" -ForegroundColor Green

    # --- 2. git pull ---
    Write-Host "[2/6] 拉取代码（git pull origin main）..." -ForegroundColor Cyan
    if ($DryRun) {
        Write-Host "  [DRY] git pull origin main"
    } else {
        git pull origin main
        if ($LASTEXITCODE -ne 0) { Write-Error "git pull 失败。" }
        Write-Host "  已拉取。" -ForegroundColor Green
    }

    # --- 3. 依赖 ---
    Write-Host "[3/6] 同步依赖（requirements.lock）..." -ForegroundColor Cyan
    if ($DryRun) {
        Write-Host "  [DRY] $VenvPip install -r $LockFile"
    } else {
        if (-not (Test-Path $LockFile)) { Write-Error "找不到 $LockFile，先跑 deploy-backend.ps1 完成首装。" }
        & $VenvPip install -r $LockFile
        if ($LASTEXITCODE -ne 0) { Write-Error "依赖安装失败。" }
        Write-Host "  依赖已同步。" -ForegroundColor Green
    }

    # --- 4. 迁移 ---
    Write-Host "[4/6] 数据库迁移..." -ForegroundColor Cyan
    if ($DryRun) {
        Write-Host "  [DRY] cd backend; $VenvAlembic upgrade head"
    } else {
        Push-Location $BackendDir
        try {
            & $VenvAlembic upgrade head
            if ($LASTEXITCODE -ne 0) { Write-Error "alembic upgrade head 失败，请检查 .env 的 DATABASE_URL。" }
        } finally {
            Pop-Location
        }
        Write-Host "  迁移完成。" -ForegroundColor Green
    }

    # --- 5. 重启服务 ---
    Write-Host "[5/6] 重启服务..." -ForegroundColor Cyan
    if ($DryRun) {
        Write-Host "  [DRY] Restart-Service $ServiceName"
    } else {
        $svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
        if (-not $svc) { Write-Error "服务 $ServiceName 不存在，请先跑 deploy-backend.ps1 完成首装。" }
        Restart-Service $ServiceName -Force
        Write-Host "  已重启。" -ForegroundColor Green
    }

    # --- 6. 健康检查 ---
    Write-Host "[6/6] 健康检查..." -ForegroundColor Cyan
    if ($DryRun) {
        Write-Host "  [DRY] Invoke-RestMethod http://127.0.0.1:$Port/live"
        Write-Host "`nDRY RUN 结束。" -ForegroundColor Yellow
    } else {
        try {
            $live = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/live" -TimeoutSec 8
            Write-Host "  /live => $($live | ConvertTo-Json -Compress)" -ForegroundColor Green
            Write-Host "`n升级完成。" -ForegroundColor Green
        } catch {
            Write-Warning "  /live 未响应：$($_.Exception.Message)。查看 $ProjectRoot\logs\backend-err.log 排查。"
            exit 1
        }
    }

    # --- 前端（可选） ---
    if ($BuildFrontend) {
        Write-Host "`n[+] 重建前端（npm ci + npm run build）..." -ForegroundColor Cyan
        if ($DryRun) {
            Write-Host "  [DRY] npm ci; npm run build"
        } else {
            npm ci
            npm run build
            if ($LASTEXITCODE -ne 0) { Write-Error "前端构建失败。" }
            Write-Host "  前端已重建（nginx 静态文件直接生效，无需重启）。" -ForegroundColor Green
        }
    } elseif (-not $DryRun) {
        Write-Host "`n提示：前端有变更时用 -BuildFrontend 重建（默认不重建）。"
    }
} finally {
    Pop-Location
}
