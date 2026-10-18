<#
.SYNOPSIS
  「一盏茶」发布快照与回滚脚本。

.DESCRIPTION
  现状缺口：scripts/ 下有 deploy-backend / update-backend / backup-postgres，
  但没有任何回滚路径。生产出问题只能靠「重新 build 一次」，而 rebuild 结果不可复现
  （依赖漂移、构建缓存、下游镜像版本变化），等于没有回滚能力。

  本脚本用镜像快照实现可复现回滚：
    1. 发布前用 -Snapshot 记录 backend / frontend 容器的镜像 ID 与 digest
    2. 出问题用 -Restore <快照文件> 把镜像重新打回 compose 使用的标签并重启
    3. 重启后强制走健康门禁（轮询 /actuator/health），未恢复则明确报失败，不做静默成功

  注意：镜像标签一旦被新构建覆盖，旧镜像 ID 仍然存在（dangling），所以快照记录的是
  镜像 ID 而非 tag —— tag 会漂移，ID 不会。若镜像已被 prune 清掉，脚本会直接报错，
  不假装回滚成功。

.PARAMETER Snapshot
  记录当前运行镜像，写到 rollback-snapshots/ 目录。

.PARAMETER Restore
  指定快照文件路径执行回滚。

.PARAMETER Service
  作用范围：all（默认）| backend | frontend。

.PARAMETER HealthTimeoutSec
  健康门禁超时秒数，默认 120。

.PARAMETER DryRun
  只打印将执行的操作，不改任何状态。

.EXAMPLE
  pwsh scripts/rollback.ps1 -Snapshot
  pwsh scripts/rollback.ps1 -Restore rollback-snapshots/20261017-1130.json

.NOTES
  需要 Docker Desktop 运行且 compose 项目已在当前仓库根目录启动。
  回滚属于生产操作：执行前按 AGENTS.md §10 确认边界。
#>
[CmdletBinding(DefaultParameterSetName = 'Snapshot')]
param(
    [Parameter(ParameterSetName = 'Snapshot')]
    [switch]$Snapshot,

    [Parameter(ParameterSetName = 'Restore', Mandatory = $true)]
    [string]$Restore,

    [ValidateSet('all', 'backend', 'frontend')]
    [string]$Service = 'all',

    [int]$HealthTimeoutSec = 120,

    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
$SnapshotDir = Join-Path $RepoRoot 'rollback-snapshots'
$HealthUrl = 'http://127.0.0.1/actuator/health'

function Write-Step([string]$Message) {
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-Plan([string]$Message) {
    Write-Host "    [dry-run] $Message" -ForegroundColor DarkYellow
}

function Get-TargetServices {
    switch ($Service) {
        'backend' { return @('backend') }
        'frontend' { return @('frontend') }
        default { return @('backend', 'frontend') }
    }
}

function Assert-DockerReady {
    docker info --format '{{.ServerVersion}}' 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) {
        throw 'Docker 未就绪（docker info 失败）。请先启动 Docker Desktop。'
    }
}

function Get-ContainerImage {
    param([string]$Name)
    $id = (docker compose ps -q $Name 2>$null)
    if ([string]::IsNullOrWhiteSpace($id)) {
        return $null
    }
    $image = (docker inspect --format '{{.Image}}' $id 2>$null)
    $tag = (docker inspect --format '{{.Config.Image}}' $id 2>$null)
    return [ordered]@{
        service  = $Name
        containerId = $id
        imageId  = $image
        imageTag = $tag
    }
}

function Invoke-Snapshot {
    Write-Step "记录当前运行镜像快照（范围：$Service）"
    if (-not (Test-Path $SnapshotDir)) {
        New-Item -ItemType Directory -Path $SnapshotDir -Force | Out-Null
    }

    $services = @()
    foreach ($s in Get-TargetServices) {
        $info = Get-ContainerImage -Name $s
        if ($null -eq $info) {
            Write-Warning "服务 $s 未运行，快照中跳过（回滚时也无法还原它）"
            continue
        }
        Write-Host "    $s  imageId=$($info.imageId.Substring(0, 19))…  tag=$($info.imageTag)"
        $services += $info
    }

    if ($services.Count -eq 0) {
        throw '没有任何在运行的目标服务，快照为空，拒绝写入。'
    }

    $record = [ordered]@{
        createdAt = (Get-Date).ToString('o')
        commit    = (& git -C $RepoRoot rev-parse HEAD 2>$null)
        branch    = (& git -C $RepoRoot rev-parse --abbrev-ref HEAD 2>$null)
        services  = $services
    }

    $file = Join-Path $SnapshotDir ("{0}.json" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
    if ($DryRun) {
        Write-Plan "将写入 $file"
        $record | ConvertTo-Json -Depth 5
        return
    }
    $record | ConvertTo-Json -Depth 5 | Set-Content -Path $file -Encoding utf8
    Write-Step "快照已写入：$file"
    Write-Host '发布后若需回滚，执行：pwsh scripts/rollback.ps1 -Restore <该文件>' -ForegroundColor Yellow
}

function Wait-Healthy {
    Write-Step "健康门禁：轮询 $HealthUrl（上限 ${HealthTimeoutSec}s）"
    $deadline = (Get-Date).AddSeconds($HealthTimeoutSec)
    while ((Get-Date) -lt $deadline) {
        try {
            $resp = Invoke-RestMethod -Uri $HealthUrl -TimeoutSec 5 -ErrorAction Stop
            if ($resp.status -eq 'UP') {
                Write-Host '    /actuator/health = UP' -ForegroundColor Green
                return $true
            }
            Write-Host "    status=$($resp.status)，继续等待…"
        }
        catch {
            Write-Host "    未就绪：$($_.Exception.Message)"
        }
        Start-Sleep -Seconds 5
    }
    return $false
}

function Invoke-Restore {
    param([string]$Path)

    if (-not (Test-Path $Path)) { throw "快照文件不存在：$Path" }
    $record = Get-Content $Path -Raw | ConvertFrom-Json

    Write-Step "回滚到快照：$Path"
    Write-Host "    快照时间：$($record.createdAt)"
    Write-Host "    快照 commit：$($record.commit)"

    $targets = $record.services | Where-Object { $Service -eq 'all' -or $_.service -eq $Service }
    if (-not $targets) { throw "快照里没有匹配 -Service $Service 的服务。" }

    foreach ($t in $targets) {
        # 镜像被 prune 过就没有可回滚的实体，这里必须显式失败，不能静默继续
        $exists = (& docker image inspect $($t.imageId) --format '{{.Id}}' 2>$null)
        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($exists)) {
            throw "镜像 $($t.imageId) 已不存在（可能被 docker image prune 清理），无法回滚 $($t.service)。请改走 git checkout $($record.commit) 重新构建。"
        }
        if ($DryRun) {
            Write-Plan "docker tag $($t.imageId) $($t.imageTag)"
            Write-Plan "docker compose up -d --no-build $($t.service)"
        }
        else {
            Write-Step "重打镜像标签：$($t.service) → $($t.imageTag)"
            & docker tag $($t.imageId) $($t.imageTag)
            if ($LASTEXITCODE -ne 0) { throw "docker tag 失败：$($t.service)" }
            & docker compose up -d --no-build --force-recreate $($t.service)
            if ($LASTEXITCODE -ne 0) { throw "docker compose up 失败：$($t.service)" }
        }
    }

    if ($DryRun) {
        Write-Plan 'health gate: GET /actuator/health until UP'
        return
    }

    if (-not (Wait-Healthy)) {
        Write-Host ''
        Write-Host '回滚后健康检查未通过。' -ForegroundColor Red
        Write-Host '下一步：docker compose logs --tail 200 backend frontend' -ForegroundColor Red
        exit 1
    }
    Write-Step '回滚完成且健康检查通过。'
    Write-Host '提醒：数据库迁移不会自动回退。若快照对应的版本与当前 Flyway 版本不一致，' -ForegroundColor Yellow
    Write-Host '需手工评估 forward-compatible 情况（见 .harness/changes/*/rollback.sql）。' -ForegroundColor Yellow
}

Assert-DockerReady
if ($PSCmdlet.ParameterSetName -eq 'Restore') {
    Invoke-Restore -Path $Restore
}
else {
    Invoke-Snapshot
}
