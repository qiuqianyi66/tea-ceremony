# 「一盏茶」阿里云生产部署方案

> 服务器：120.26.49.122 | Windows Server 2022 | 2核2G | 40GB

---

## 一、服务器准备清单（你需要在服务器上操作）

### 1. 安装 Docker
Windows Server 2022 支持 Docker：

```powershell
# 以管理员身份运行 PowerShell
Install-WindowsFeature -Name Containers
Install-WindowsFeature -Name Docker
Restart-Computer

# 安装后验证
docker --version
docker compose version
```

### 2. 安装 Git
```powershell
winget install Git.Git
```

### 3. 安全组配置（阿里云控制台）
在阿里云 ECS 控制台 → 安全组 → 添加入方向规则：

| 端口 | 协议 | 用途 | 来源 |
|------|------|------|------|
| 80 | TCP | HTTP 访问 | 0.0.0.0/0 |
| 443 | TCP | HTTPS（可选）| 0.0.0.0/0 |
| 22 | TCP | SSH（若启用）| 你的 IP |

### 4. 克隆项目
```powershell
cd C:\
git clone https://github.com/你的仓库/tea.git
cd tea
```

### 5. 配置环境变量
创建 `backend/.env` 文件：

```env
DATABASE_URL=postgresql://tea_user:tea_pass@db:5432/tea_ceremony
SECRET_KEY=你的随机密钥
```

生成密钥：
```powershell
# 生成随机密钥
python3 -c "import secrets; print(secrets.token_hex(32))"
```

### 6. 启动服务
```powershell
docker compose up -d --build
```

---

## 二、代码层面的部署配置（已就绪）

### docker-compose.yml（已有）
- PostgreSQL 16（带初始化脚本）
- FastAPI 后端（含 healthcheck）
- Nginx 前端（含安全头部）

### nginx.conf（已有）
- SPA 路由支持
- 安全头部（CSP, X-Frame-Options 等）
- Gzip 压缩
- 静态资源缓存（1年）
- API 反向代理
- 代理 IP 转发

### 需要新增的配置

#### 1. 生产环境 docker-compose.override.yml
```yaml
services:
  backend:
    environment:
      - SECRET_KEY=${SECRET_KEY}
    restart: always

  frontend:
    restart: always
```

#### 2. 构建前需执行
```bash
cd tea
npm run build        # 构建前端到 dist/
docker compose up -d # 启动所有服务
```

---

## 三、访问地址

部署完成后：
- **前端**：http://120.26.49.122（Nginx 80 端口）
- **API**：http://120.26.49.122/api/
- **API 文档**：http://120.26.49.122/api/docs

---

## 四、数据初始化

首次部署后需导入种子数据：

```powershell
docker compose exec backend python -m seeds.run
```

或后续手动运行：
```powershell
docker compose exec backend python -m app.seeds.run
```

---

## 五、维护命令

| 操作 | 命令 |
|------|------|
| 查看日志 | `docker compose logs -f` |
| 停止服务 | `docker compose down` |
| 重启服务 | `docker compose restart` |
| 更新代码 | `git pull && docker compose up -d --build` |
| 备份数据库 | `docker compose exec db pg_dump -U tea_user tea_ceremony > backup.sql` |

---

## 六、域名和 HTTPS

建议后续配置：
1. 购买域名（如 chadao.你的域名.com）
2. 域名解析到 120.26.49.122
3. 用 Certbot / Let's Encrypt 配置 HTTPS
4. nginx 配置强制 HTTPS 跳转
