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

# --proxy-headers：解析 Nginx 传入的 X-Forwarded-*，否则全用户共享一个限流 key、日志无真实 IP
# --forwarded-allow-ips=172.16.0.0/12：只信任 Docker 内网网段的 XFF（Compose 默认 172.x）
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "172.16.0.0/12"]
