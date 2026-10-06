# ============ builder：前端构建（npm ci + vite build，CI 同款命令） ============
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build-only

# ============ runtime：nginx + brotli，静态产物自包含在镜像内 ============
# P2-10 官方 nginx:alpine 不带 brotli：装 Alpine community 的 nginx-mod-http-brotli，
# 并在主 nginx.conf 的 main context（events 之前）加 load_module。
# 版本锁定：Alpine 仓库 nginx-mod-http-brotli 依赖 nginx=1.30.4-r1（精确版本）；
# nginx:alpine 最新（1.31.x）与 1.30-alpine（1.30.5）都与其错配，apk 版本冲突装不上。
# 锁 nginx:1.30.4-alpine（镜像内包版本恰为 1.30.4-r1，apk 依赖命中）。
FROM nginx:1.30.4-alpine
RUN apk add --no-cache nginx-mod-http-brotli \
    && sed -i '1i load_module modules/ngx_http_brotli_filter_module.so;\nload_module modules/ngx_http_brotli_static_module.so;' /etc/nginx/nginx.conf
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
