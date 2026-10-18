<#
.SYNOPSIS
    生成自签证书到 ./certs/（fullchain.pem + privkey.pem），仅供本地/预发验证 HTTPS 配置。

.DESCRIPTION
    ⚠ 浏览器会告警（NET::ERR_CERT_AUTHORITY_INVALID），因为证书不是公共 CA 签的。
    ⚠ 不要用于生产：客户端无法验证身份，等于没有 TLS 的防冒充能力。
    生产请用 scripts/https-issue-cert.sh 签 Let's Encrypt IP 证书（shortlived profile）。

    为什么要走 docker + openssl 而不是 PowerShell 自带能力：
      Windows PowerShell 5.1 的 .NET Framework 没有 RSA.ExportPkcs8PrivateKey，
      导不出 PEM 私钥；系统 openssl 又常常没装。用一次性 alpine 容器（apk 装 openssl）
      可以做到不往宿主装任何依赖，产物格式与 nginx 期望的 PEM 完全一致。
      需要 Docker 可用；容器内 apk 安装需要一次联网（约 3MB）。

.EXAMPLE
    pwsh -File scripts/https-selfsigned.ps1
    powershell -File scripts/https-selfsigned.ps1 -Ip 42.121.125.4 -Days 30
#>
param(
    [string]$Ip = '127.0.0.1',
    [int]$Days = 365,
    [string]$CertsDir = (Join-Path (Split-Path -Parent $PSScriptRoot) 'certs'),
    [string]$Image = 'alpine:3.20'
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw '没找到 docker：自签证书脚本用一次性 alpine 容器装 openssl，需要 Docker Desktop 在跑。'
}

$outDir = [System.IO.Path]::GetFullPath($CertsDir)
if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir -Force | Out-Null }

# Windows 路径直接给 -v（Docker Desktop 认 C:\... 形式）
$san = "IP:$Ip,DNS:localhost"

Write-Host "[selfsigned] 生成 $Ip 的自签证书 -> $outDir（$Days 天有效）"
& docker run --rm -v "${outDir}:/certs" $Image sh -c @"
set -e
apk add --no-cache openssl >/dev/null
openssl req -x509 -nodes -newkey rsa:2048 -sha256 \
  -days $Days \
  -keyout /certs/privkey.pem \
  -out /certs/fullchain.pem \
  -subj "/CN=$Ip" \
  -addext "subjectAltName=$san" \
  -addext "keyUsage=digitalSignature,keyEncipherment" \
  -addext "extendedKeyUsage=serverAuth"
chmod 600 /certs/privkey.pem
chmod 644 /certs/fullchain.pem
openssl x509 -in /certs/fullchain.pem -noout -subject -dates
"@
if ($LASTEXITCODE -ne 0) { throw "openssl 生成证书失败（exit $LASTEXITCODE）" }

foreach ($f in @('fullchain.pem', 'privkey.pem')) {
    $p = Join-Path $outDir $f
    if (-not (Test-Path $p)) { throw "预期产物不存在：$p" }
}
Write-Host '[selfsigned] 完成。下一步：docker compose up -d frontend 然后 curl -kI https://localhost/ '
Write-Host '[selfsigned] 提醒：浏览器会告警；certs/ 已在 .gitignore，别把私钥提交上去。'
