FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# --proxy-headers：解析 Nginx 传入的 X-Forwarded-*，否则全用户共享一个限流 key、日志无真实 IP
# --forwarded-allow-ips=172.16.0.0/12：只信任 Docker 内网网段的 XFF（Compose 默认 172.x）
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "172.16.0.0/12"]
