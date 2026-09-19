# ============ builder：安装依赖（缓存层） ============
FROM python:3.12-slim AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ============ runtime：只带依赖与应用，非 root 运行 ============
FROM python:3.12-slim AS runtime
WORKDIR /app
# 依赖与标准库分离：runtime 基础镜像自带标准库，只合并安装的 site-packages
COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY . .

# 非 root 用户：容器逃逸时不以 root 权限运行
RUN useradd --create-home --shell /usr/sbin/nologin appuser
USER appuser

EXPOSE 8000

# P1-11：生产 4 worker（gunicorn + UvicornWorker，FastAPI 官方推荐）。
# --forwarded-allow-ips=172.16.0.0/12：UvicornWorker 据此启用 proxy headers，
# 只信任 Docker 内网网段的 XFF（Compose 默认 172.x），否则全用户共享一个限流 key、日志无真实 IP。
# 限流计数经 Redis 共享（REDIS_URL 配置时）；未配 Redis 时 4 worker 各自内存限流（部署文档注明）。
CMD ["gunicorn", "main:app", "-k", "uvicorn.workers.UvicornWorker", "-w", "4", "-b", "0.0.0.0:8000", "--forwarded-allow-ips", "172.16.0.0/12"]
