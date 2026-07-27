@echo off
echo ================
echo 一盏茶 启动脚本
echo ================

cd /d C:\tea

echo [1/3] 构建前端...
if not exist dist (
    echo 构建中...
    call npm run build
)

echo [2/3] 安装 API 依赖...
cd /d C:\tea\api-server
if not exist node_modules call npm install

echo [3/3] 启动统一服务（端口 80）...
start /B node index.js

echo.
echo ✅ 一盏茶已启动！
echo 访问地址：http://localhost:80
echo 外网地址：http://120.26.49.122
echo API 地址：http://localhost:80/api
echo.
echo 按任意键关闭此窗口（服务将在后台继续运行）
pause >nul
