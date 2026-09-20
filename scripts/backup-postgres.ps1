<#
.SYNOPSIS
  PostgreSQL 每日备份（Windows 原生，无 Docker）。

.DESCRIPTION
  pg_dump 逻辑备份 -> gzip -> 保留最近 14 天，自动清理过期备份。
  由 Windows 任务计划程序每日调用（见 DEPLOY.md「数据库备份」）。

  密码走环境变量 PGPASSWORD（任务计划程序里在「操作」前置，或写进本文件顶部）。
  不在脚本里硬编码密码。

.PARAMETER BackupDir
  备份目录，默认 C:\tea\backups

.PARAMETER KeepDays
  保留天数，默认 14

.PARAMETER PgBin
  PostgreSQL bin 目录，默认 EDB 安装路径

.EXAMPLE
  .\scripts\backup-postgres.ps1
  $env:PGPASSWORD='xxx'; .\scripts\backup-postgres.ps1 -KeepDays 30
#>

param(
    [string]$BackupDir = "C:\tea\backups",
    [int]$KeepDays = 14,
    [string]$PgBin = "C:\Program Files\PostgreSQL\17\bin",
    [string]$PgUser = "tea_user",
    [string]$PgDb = "tea_ceremony"
)

$ErrorActionPreference = "Stop"

if (-not $env:PGPASSWORD) {
    Write-Error "未设置环境变量 PGPASSWORD。请先 `$env:PGPASSWORD = 'tea_user密码' 再运行。"
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$sqlFile   = Join-Path $BackupDir "tea_$timestamp.sql"
$gzFile    = "$sqlFile.gz"

New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

# 1. pg_dump 到临时 .sql
$pgDump = Join-Path $PgBin "pg_dump.exe"
if (-not (Test-Path $pgDump)) {
    Write-Error "未找到 $pgDump 。确认 PostgreSQL 安装路径，用 -PgBin 指定。"
}
& $pgDump -U $PgUser -d $PgDb -f $sqlFile
if ($LASTEXITCODE -ne 0) {
    Write-Error "pg_dump 失败（exit $LASTEXITCODE）"
}

# 2. 非空校验（pg_dump 失败可能产出空文件）
if (-not (Test-Path $sqlFile) -or (Get-Item $sqlFile).Length -eq 0) {
    Remove-Item $sqlFile -Force -ErrorAction SilentlyContinue
    Write-Error "备份文件为空（pg_dump 可能失败）：$sqlFile"
}

# 3. gzip 压缩（用 .NET GzipStream）
$sqlBytes = [System.IO.File]::ReadAllBytes($sqlFile)
$fs = [System.IO.File]::Create($gzFile)
$gz = New-Object System.IO.Compression.GzipStream($fs, [System.IO.Compression.CompressionMode]::Compress)
$gz.Write($sqlBytes, 0, $sqlBytes.Length)
$gz.Close(); $fs.Close()
Remove-Item $sqlFile -Force

# 4. 清理超过 KeepDays 的旧备份
Get-ChildItem -Path $BackupDir -Filter "tea_*.sql.gz" |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$KeepDays) } |
    Remove-Item -Force

# 5. 输出一行日志（任务计划程序会合并到操作日志）
$sizeMB = [math]::Round((Get-Item $gzFile).Length / 1MB, 2)
Write-Output "备份完成: $gzFile ($sizeMB MB, 保留 $KeepDays 天)"
