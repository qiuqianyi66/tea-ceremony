#!/usr/bin/env bash
# 为裸 IP 签发 Let's Encrypt 证书（shortlived profile，约 6 天有效）并落到 ./certs/
#
# 为什么用 certbot 容器而不是在宿主装客户端：
#   1) 证书私钥只落在 ./certs/（已在 .gitignore），不散落到宿主 ~/.acme.sh 之类的位置；
#   2) 与 nginx 容器共用同一份 certbot-www 卷，续期不依赖宿主包管理器；
#   3) 版本可控：IP 证书要求 certbot >= 5.4（--ip-address + webroot 支持），脚本启动时自检。
#
# 前置条件（缺一项就签不下来，脚本会明确报是哪一项）：
#   - 云安全组放通 TCP 80（HTTP-01 只能走 80，LE 不跟随 301 跳转）
#   - 服务器能出站访问 https://acme-v02.api.letsencrypt.org
#   - 该 IP 当前没有 CDN / 反向代理在前（挑战文件必须由本机 80 直接返回）
#   - certbot >= 5.4；本机 docker + docker compose v2
#
# 用法：
#   scripts/https-issue-cert.sh --ip 42.121.125.4 --email you@example.com            # 默认 staging
#   scripts/https-issue-cert.sh --ip 42.121.125.4 --email you@example.com --production
#   scripts/https-issue-cert.sh --renew --ip 42.121.125.4 --email you@example.com     # 续期
#
# 退出码：0 成功；非 0 失败（失败时打印可操作提示）。
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CERTBOT_IMAGE="${CERTBOT_IMAGE:-certbot/certbot:latest}"
LE_CONF_DIR="$ROOT/certbot/conf"
LE_LIB_DIR="$ROOT/certbot/lib"
WEBROOT_HOST_DIR="$ROOT/certbot-www"
OUT_DIR="$ROOT/certs"

IP=""
EMAIL=""
STAGING=1
METHOD="standalone"
RENEW=0

log()  { printf '[issue-cert] %s\n' "$*"; }
die()  { printf '[issue-cert] 失败：%s\n' "$*" >&2; exit 1; }

usage() {
  cat <<'EOF'
用法：scripts/https-issue-cert.sh --ip <IP> --email <ASCII 邮箱> [选项]

选项：
  --ip <IP>         必填，绑定到证书的公网 IPv4（SAN = IP Address:<IP>）
  --email <addr>    必填，Let's Encrypt 账户联系邮箱（必须是 ASCII）
  --staging         使用 LE staging（默认；不占生产配额，签出的证书浏览器不信任）
  --production      使用 LE 生产环境（同一 IP 每周 5 张配额）
  --method <m>      签发方式：standalone（默认，停前端独占 80）| webroot（前端在跑，零停机）
  --renew           续期（沿用 certbot 已保存的续期配置）
  -h, --help        显示本帮助

环境变量：CERTBOT_IMAGE（默认 certbot/certbot:latest，必须 >= 5.4）
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ip)         IP="${2:-}"; shift 2 ;;
    --email)      EMAIL="${2:-}"; shift 2 ;;
    --staging)    STAGING=1; shift ;;
    --production) STAGING=0; shift ;;
    --method)     METHOD="${2:-}"; shift 2 ;;
    --renew)      RENEW=1; shift ;;
    -h|--help)    usage; exit 0 ;;
    *)            die "未知参数 $1（用 --help 看用法）" ;;
  esac
done

# ---------- 参数校验 ----------
[[ -n "$IP" ]]    || die "必须给 --ip <公网 IP>"
[[ -n "$EMAIL" ]] || die "必须给 --email <联系邮箱>（LE 注册账户要它，且必须是 ASCII）"

if ! [[ "$IP" =~ ^([0-9]{1,3}\.){3}[0-9]{1,3}$ ]]; then
  die "IP 必须是 IPv4 字面量，收到：$IP"
fi
# 2026-10-18 实测教训（见 docs/plans/PLAN-ip-cert-2026-10-18.md §7）：
# 邮箱含非 ASCII（如中文占位符）会让 LE 账户注册报 invalidContact，且报错位置在签发阶段，误导排查。
if ! [[ "$EMAIL" =~ ^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]]; then
  die "邮箱必须是纯 ASCII 地址（不要用「你的邮箱@example.com」这类占位符），收到：$EMAIL"
fi
case "$METHOD" in
  standalone|webroot) ;;
  *) die "--method 只能是 standalone 或 webroot，收到：$METHOD" ;;
esac

command -v docker >/dev/null 2>&1 || die "没找到 docker"

compose() { ( cd "$ROOT" && docker compose "$@" ); }

if ! compose config -q >/dev/null 2>&1; then
  die "docker compose 配置校验失败（通常是没有 .env）。先在 $ROOT 下 cp .env.example .env 并填 DB_PASSWORD / JWT_SECRET / AI_GATEWAY_API_KEY"
fi

# ---------- certbot 版本自检：IP 证书是 5.3/5.4 才有的能力 ----------
CB_VER="$(docker run --rm --entrypoint certbot "$CERTBOT_IMAGE" --version 2>/dev/null | awk '{print $2}' || true)"
[[ -n "$CB_VER" ]] || die "拉不到 certbot 镜像或 certbot --version 失败（镜像：$CERTBOT_IMAGE）"

ver_ge() { # ver_ge 5.4.0 5.4 -> 0/1
  local a="$1" b="$2"
  [[ "$(printf '%s\n%s\n' "$a" "$b" | sort -V | head -n1)" == "$b" ]]
}
ver_ge "$CB_VER" "5.4" || die "certbot 版本 $CB_VER < 5.4：IP 证书需要 --ip-address（5.3 引入）与 webroot+IP 支持（5.4）。
  → 用 CERTBOT_IMAGE=certbot/certbot:v5.4.0 scripts/https-issue-cert.sh ... 指定更新镜像，或先 docker pull $CERTBOT_IMAGE"
log "certbot $CB_VER，镜像 $CERTBOT_IMAGE"

mkdir -p "$LE_CONF_DIR" "$LE_LIB_DIR" "$WEBROOT_HOST_DIR" "$OUT_DIR"

CB_COMMON=(
  --rm
  -v "$LE_CONF_DIR:/etc/letsencrypt"
  -v "$LE_LIB_DIR:/var/lib/letsencrypt"
  -v "$WEBROOT_HOST_DIR:/var/www/certbot"
)

STAGING_FLAG=()
if [[ "$STAGING" -eq 1 ]]; then STAGING_FLAG=(--staging); log "使用 staging（不占生产配额）"; else log "使用生产环境（会占用 LE 配额：同一 IP 每周 5 张）"; fi

FRONTEND_WAS_RUNNING=0
if compose ps --status running --services 2>/dev/null | grep -qx frontend; then
  FRONTEND_WAS_RUNNING=1
fi

FAIL_HINT=""
on_error() {
  cat >&2 <<'EOS'
[issue-cert] 常见失败与处置：
  1) "Failed authorization procedure" / "unauthorized" / timeout
     → 80 端口不通：云安全组未放通 TCP 80，或前端 nginx 没在跑。
       http://<IP>/.well-known/acme-challenge/<token> 必须能被公网访问（不是 301、不是 404）。
       本机自测：curl -i http://<IP>/  （看到 301 才算 80 通）
  2) "too many certificates already issued" / "rateLimited"
     → 生产环境配额打满。改用默认的 --staging 先把链路跑通，成功后再 --production。
  3) "invalidContact" / 邮箱校验错
     → 邮箱拼错或含非 ASCII 字符（LE 只收 ASCII）。换 ASCII 邮箱重跑。
  4) "Certbot version does not support IP addresses" / unknown option --ip-address
     → 镜像太旧。设 CERTBOT_IMAGE=certbot/certbot:v5.4.0（或更新）重跑。
  5) "Address already in use" 且 method=standalone
     → 80 被占用：先 docker compose stop frontend，或改用 --method webroot（需前端已在跑）。
  6) 签发成功但浏览器仍告警
     → staging 证书不被信任（这是预期的）。去掉 --staging 重签一次。
EOS
  [[ -n "$FAIL_HINT" ]] && printf '[issue-cert] 本次失败上下文：%s\n' "$FAIL_HINT" >&2
  exit 1
}
trap on_error ERR

# ---------- 签发 ----------
if [[ "$RENEW" -eq 1 ]]; then
  if [[ "$METHOD" == "standalone" && "$FRONTEND_WAS_RUNNING" -eq 1 ]]; then
    log "standalone 续期要独占 80，先停 frontend"
    compose stop frontend
  fi
  docker run "${CB_COMMON[@]}" --entrypoint certbot "$CERTBOT_IMAGE" \
    renew --preferred-profile shortlived --non-interactive ${STAGING_FLAG[@]+"${STAGING_FLAG[@]}"}
  FAIL_HINT="renew"
else
  case "$METHOD" in
    standalone)
      # standalone 起自己的临时 HTTP 服务，必须独占宿主 80
      if [[ "$FRONTEND_WAS_RUNNING" -eq 1 ]]; then
        log "standalone 模式要独占 80，先停 frontend（签完自动拉起）"
        compose stop frontend
      fi
      docker run "${CB_COMMON[@]}" -p 80:80 --entrypoint certbot "$CERTBOT_IMAGE" \
        certonly --standalone \
        --ip-address "$IP" \
        --preferred-profile shortlived \
        --email "$EMAIL" --agree-tos --no-eff-email \
        --non-interactive ${STAGING_FLAG[@]+"${STAGING_FLAG[@]}"}
      FAIL_HINT="standalone 签发 $IP"
      ;;
    webroot)
      # webroot 依赖 nginx 的 /.well-known/acme-challenge/ 与 ./certbot-www 共享卷（零停机）
      if [[ "$FRONTEND_WAS_RUNNING" -ne 1 ]]; then
        die "webroot 模式要求 frontend 已在运行（它负责把挑战文件发出去）。
  → 首次签发用默认的 --method standalone；已有证书、只想续期时才用 webroot。"
      fi
      docker run "${CB_COMMON[@]}" --entrypoint certbot "$CERTBOT_IMAGE" \
        certonly --webroot --webroot-path /var/www/certbot \
        --ip-address "$IP" \
        --preferred-profile shortlived \
        --email "$EMAIL" --agree-tos --no-eff-email \
        --non-interactive ${STAGING_FLAG[@]+"${STAGING_FLAG[@]}"}
      FAIL_HINT="webroot 签发 $IP"
      ;;
  esac
fi

# ---------- 导出证书到 ./certs/ ----------
# certbot 的 live/ 里是符号链接，指向 archive/ 下的版本化文件；
# 这里把内容复制出来（cp 跟随符号链接），避免 compose 挂载到断链。
log "导出 fullchain.pem / privkey.pem 到 $OUT_DIR"
docker run --rm \
  -v "$LE_CONF_DIR:/etc/letsencrypt:ro" \
  -v "$OUT_DIR:/out" \
  --entrypoint /bin/sh "$CERTBOT_IMAGE" -c '
    set -e
    line=$(ls -1dt /etc/letsencrypt/live/*/ 2>/dev/null | head -n1)
    [ -n "$line" ] || { echo "没有找到 /etc/letsencrypt/live/*/ 目录" >&2; exit 1; }
    cp "$line/fullchain.pem" /out/fullchain.pem
    cp "$line/privkey.pem"   /out/privkey.pem
    chmod 644 /out/fullchain.pem
    chmod 600 /out/privkey.pem
    echo "来源：$line"
  '
FAIL_HINT="导出证书"

# 宿主侧再兜一次权限（容器内 chmod 已做，这里防 umask/挂载差异）
chmod 600 "$OUT_DIR/privkey.pem" 2>/dev/null || true
chmod 644 "$OUT_DIR/fullchain.pem" 2>/dev/null || true

# ---------- 恢复前端 ----------
if [[ "$FRONTEND_WAS_RUNNING" -eq 1 ]]; then
  log "重新拉起 frontend（会加载新证书）"
  compose up -d frontend
fi

cat <<EOS

[issue-cert] 完成。证书：
  $OUT_DIR/fullchain.pem
  $OUT_DIR/privkey.pem  (600)

下一步（DEPLOY.md「HTTPS 启用顺序」）：
  1) docker compose up -d frontend
  2) docker compose exec frontend nginx -t
  3) curl -kI https://$IP/          # 期望 200 + strict-transport-security
  4) 浏览器确认无证书告警后，再把站内 http:// 链接换成 https://

续期（shortlived 约 6 天）：建议 cron 每 2~4 天跑
  scripts/https-issue-cert.sh --renew --ip $IP --email $EMAIL $( [[ $STAGING -eq 1 ]] && echo '--staging' || echo '--production' )
EOS
