# P2-10 前端 Nginx：官方 alpine + brotli 模块（官方 nginx:alpine 不带 brotli）
# 模块包：Alpine community 仓库 nginx-mod-http-brotli；Alpine 不自动加载模块，
# 需在主 nginx.conf 的 main context（events 之前）加 load_module。
FROM nginx:alpine

RUN apk add --no-cache nginx-mod-http-brotli \
    && sed -i '1i load_module modules/ngx_http_brotli_filter_module.so;\nload_module modules/ngx_http_brotli_static_module.so;' /etc/nginx/nginx.conf
