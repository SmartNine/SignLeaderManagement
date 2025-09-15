#!/bin/bash

echo "🚀 开始部署 Signleader 系统"

# 设置变量
FRONTEND_DIR="./signleader-admin"
BACKEND_DIR="./signleader-backend"
FRONTEND_DIST_DIR="$FRONTEND_DIR/dist"
DEPLOY_DIR="/var/www/signleader"         # 前端部署到这里
API_PORT=3000

echo "🔧 安装后端依赖..."
cd $BACKEND_DIR
npm install

echo "🔧 启动后端服务（pm2）..."
if ! command -v pm2 &> /dev/null; then
  npm install -g pm2
fi
pm2 delete signleader-api 2>/dev/null
pm2 start index.js --name signleader-api

echo "🌐 安装前端依赖..."
cd ../$FRONTEND_DIR
npm install

echo "📦 构建前端项目..."
npm run build

echo "📁 拷贝前端 dist 到部署目录..."
sudo mkdir -p $DEPLOY_DIR
sudo cp -r $FRONTEND_DIST_DIR/* $DEPLOY_DIR/

echo "✅ 部署完成，前端已部署到：$DEPLOY_DIR"
echo "✅ 后端已运行在 pm2，端口：$API_PORT"
