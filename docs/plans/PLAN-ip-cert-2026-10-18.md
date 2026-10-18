---
name: plan-ip-cert-2026-10-18
description: 裸 IP（42.121.125.4）上 HTTPS 的可执行方案——用 Let's Encrypt IP 证书（shortlived profile，6 天有效期，需自动续期），无需域名与 ICP 备案。含前置条件、逐条命令、验证与回滚；前置缺失项为服务器 SSH 凭证与 443 安全组。
status: completed
owner: yanha
last_updated: 2026-10-18
---

# 裸 IP 上 HTTPS：Let's Encrypt IP 证书部署方案

## 0. 为什么不用域名

国内 ECS 绑域名必须 **ICP 备案**（实名 + 约 20 工作日），否则 80/443 被封。而 Let's Encrypt 的 `shortlived` profile **支持 IP 地址证书**，可绕开域名与备案直接上 HTTPS。

依据（2026-10-17 查 Let's Encrypt 官方 Profiles 文档，2026-10-04 更新）：

| profile | Identifier Types | 有效期 |
|---|---|---|
| classic | DNS | 90 天 |
| tlsserver | DNS | 90 天 |
| **shortlived** | **DNS, IP** | **160 小时（≈6.7 天），无 CRL** |

**代价**：6.7 天有效期 → 必须自动续期（建议每 4 天一次）。

## 1. 现状实测（2026-10-18）

| 项 | 实测结果 |
|---|---|
| 生产 IP | `42.121.125.4`（README / ADR-021 / TODO-PRIORITY 均指向此；HTTP 200，Server: nginx/1.30.4） |
| 端口 80 | **开** → ACME HTTP-01 challenge 可用 |
| 端口 443 | **关** → 需在云平台安全组放通 |
| 端口 22 | 开 |
| nginx HTTPS 模板 | `nginx.conf` L135-145 已有完整 443 server 块（注释状态），证书路径 `/etc/nginx/certs/fullchain.pem` + `privkey.pem` |
| 顺带修的漂移 | `DEPLOY.md` 原写 `120.26.49.122`（5 处），该 IP 实测 ping 不通 → 已全部改为 `42.121.125.4` |

## 2. 前置条件（当前阻塞，需用户处理）

| # | 条件 | 状态 |
|---|---|---|
| 1 | 服务器 SSH 凭证（user@42.121.125.4 + 端口 + 密钥或密码） | ⬜ **缺失** —— 本机 `~/.ssh/config` 只有 github.com 条目 |
| 2 | 云平台安全组放通 TCP 443 | ⬜ 待确认（当前 443 关） |
| 3 | 服务器可访问 Let's Encrypt ACME 端点（出站 443） | ⬜ 待确认 |

第 1 项是硬阻塞：本会话无法 SSH 到服务器，故以下为**待执行的方案**，不是已完成的部署。

## 3. 部署步骤（凭证到位后按序执行）

### 步骤 1 · 确认 ACME 客户端支持 IP 证书

```bash
# acme.sh：确认版本与是否支持 --profile（IP 证书依赖 shortlived profile）
acme.sh --version
acme.sh --help | grep -i profile

# 若 acme.sh 不支持，换 lego（Go 客户端，对 profile/IP 支持更明确）
lego --version
lego dnshelp 2>/dev/null; lego --help | grep -i profile
```

**先跑这一步再往下走**：客户端若不支持 `shortlived` profile，则 IP 证书路径不成立，需回退到「买域名 + 备案」或「自签证书（浏览器告警）」。

### 步骤 2 · 安装 acme.sh（若未装）

```bash
curl https://get.acme.sh | sh -s email=you@example.com
source ~/.bashrc
```

### 步骤 3 · 申请 IP 证书

```bash
# 以 acme.sh 为例（具体参数名以步骤 1 实测为准）
acme.sh --issue --standalone -d 42.121.125.4 --profile shortlived --server letsencrypt
# 或用 webroot（nginx 已在跑 80，standalone 需先停 nginx 或换端口）
acme.sh --issue -w /usr/share/nginx/html -d 42.121.125.4 --profile shortlived --server letsencrypt
```

> `--standalone` 会临时占用 80；生产环境建议用 `-w` webroot 方式，避免中断现有站点。

### 步骤 4 · 安装证书到 nginx 约定路径

```bash
mkdir -p /etc/nginx/certs
acme.sh --install-cert -d 42.121.125.4 \
  --key-file       /etc/nginx/certs/privkey.pem \
  --fullchain-file /etc/nginx/certs/fullchain.pem \
  --reloadcmd      "nginx -t && nginx -s reload"
```

### 步骤 5 · 启用 nginx 443

编辑 `nginx.conf`，把 L135-145 的注释块放开，并调整：

```nginx
server {
    listen 443 ssl;
    http2 on;
    server_name 42.121.125.4;          # 裸 IP 作为 server_name

    ssl_certificate     /etc/nginx/certs/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache   shared:SSL:10m;
    ssl_session_timeout 1d;

    add_header Strict-Transport-Security "max-age=31536000" always;

    # 其余 location 与 80 端口 server 保持一致
}
```

同时建议把 80 端口的 HTTP 请求 301 到 HTTPS（ACME 续期的 `/.well-known/acme-challenge/` 需保留在 80 上）。

### 步骤 6 · 自动续期

IP 证书 6.7 天有效期，必须每 4 天续一次：

```bash
# acme.sh 默认会装 cron，但默认周期是 60 天，需改为 4 天
crontab -e
# 加入：
0 3 */4 * * "/root/.acme.sh"/acme.sh --cron --home "/root/.acme.sh" > /dev/null
```

### 步骤 7 · 验证

```bash
nginx -t && nginx -s reload
curl -I https://42.121.125.4        # 期望 200，且无证书告警
curl -vI https://42.121.125.4 2>&1 | grep -i "subject\|issuer\|expire"
```

再从外网用浏览器打开 `https://42.121.125.4`，确认锁标正常、无 `NET::ERR_CERT_*`。

## 4. 回滚

```bash
# 停 443、恢复纯 HTTP
# 1) nginx.conf 把 443 server 块重新注释掉
nginx -t && nginx -s reload
# 2) 证书文件可保留，不影响 HTTP 访问
```

## 5. 风险与边界

| 风险 | 影响 | 缓解 |
|---|---|---|
| 客户端不支持 shortlived profile | 方案不成立 | 步骤 1 先验证；不成立则改走域名+备案或自签 |
| 6.7 天有效期，续期失败 | 站点证书过期 → 浏览器告警 | cron 每 4 天 + 续期后 reload；建议加一条过期前告警 |
| 国内访问 Let's Encrypt 不稳 | 签发/续期失败 | 服务器需能出站访问 ACME；若不通，需换支持国内的 CA（多收费） |
| HSTS 一旦下发 | 30 天内强制 HTTPS | 先不加 HSTS，稳定后再加 `max-age` |
| 本会话无法 SSH | 无法亲自执行 | 需用户提供 SSH 凭证 |

## 6. 未做的事

- 未连接服务器（无 SSH 凭证）
- 未实际签发证书
- 未修改 nginx.conf 的 HTTPS 块（仍保持注释状态）

以上均待前置条件（§2）满足后执行。

## 7. 执行结果（2026-10-18，**已完成**）

| 项 | 结果 |
|---|---|
| 证书签发 | ✅ `Cert success.`，SAN = `IP Address:42.121.125.4` |
| 有效期 | 实测 `notBefore Oct 18 02:42` → `notAfter Oct 24 18:41`（6.7 天）|
| HTTPS | ✅ `curl -Ik https://42.121.125.4` → `HTTP/2 200` |
| 挂载 | ✅ nginx.conf + certs 两个 bind mount 生效 |
| 自动续期 | ✅ cron `17 4 */2 * *` + `renew-cert.sh` |
| 强制续期实测 | ✅ `--renew --force` 跑通，notAfter 刷新，站点恢复 200 |

### 本次实测踩到的 3 个坑（原方案未预见）

1. **acme.sh 默认 CA 是 ZeroSSL，不是 Let's Encrypt**
   - `acme.sh --register-account` 注册的是 ZeroSSL；签发时加 `--server letsencrypt` 会另外注册 LE 账户。
   - 若安装脚本传入的邮箱含非 ASCII（如占位符「你的邮箱@example.com」），LE 注册会报 `invalidContact: contact email contains non-ASCII characters`。
   - 正确做法：`acme.sh --register-account -m <真实邮箱> --server letsencrypt` 显式注册一次。

2. **standalone 续期需要 80 端口，而 nginx 正占着它**
   - `acme.sh --cron --force` → `tcp port 80 is already used`。
   - 解决：续期脚本先 `docker compose stop frontend`，续完再 `start`（停站约 30 秒，6.7 天一次，可接受）。
   - 更优雅的替代是改 webroot 模式（nginx 暴露 `/.well-known/acme-challenge/`），可做到零中断，本次未采用。

3. **reloadcmd 在停站续期时必然失败**
   - acme.sh 在证书写入瞬间就执行 reloadcmd，此时容器还是停的 → `service "frontend" is not running`。
   - 实际无害（后面 `docker compose start` 会加载新证书），但为干净要写成「先 start 再 reload」。`start` 对已运行的容器是幂等的。

### 仍未处理

- 443 server 块的 `/api/` 缺 `X-Request-ID`（80 块有）—— 仅影响链路追踪，不影响功能。
- `README` / `index.html` 的链接已改为 https（本 PR）；`TODO-PRIORITY.md` 里 2026-10-13 的历史记录保持 http 原样（不篡改历史）。
