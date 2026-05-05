#!/bin/bash

# =============================
# 配置变量
# =============================
REMOTE=signleader
REMOTE_USER=root
REMOTE_HOST=47.251.171.137

REMOTE_CLIENT_PATH=/var/www/signleader-management/signleader-admin
REMOTE_SERVER_PATH=/var/www/signleader-management/signleader-backend
REMOTE_ECOSYSTEM_PATH=/var/www/signleader-management/ecosystem.config.js
REMOTE_NGINX_CONF=/www/server/panel/vhost/nginx/signleader-management.conf

LOCAL_CLIENT_BUILD_DIR=signleader-admin/dist

echo "🔄 [0/6] 拉取最新 Git 代码..."
git pull origin main || { echo "❌ Git 拉取失败"; exit 1; }

echo "📦 [1/6] 安装本地依赖..."
(cd signleader-admin && npm install) || { echo "❌ signleader-admin 依赖安装失败"; exit 1; }
(cd signleader-backend && npm install) || { echo "❌ signleader-backend 依赖安装失败"; exit 1; }

echo "🏗️  [2/6] 构建前端..."
(cd signleader-admin && npm run build) || { echo "❌ 前端构建失败"; exit 1; }

echo "🗂️  [Pre] 确保远程路径存在..."
ssh $REMOTE "mkdir -p $REMOTE_CLIENT_PATH && mkdir -p $REMOTE_SERVER_PATH"

echo "🧹 [3/6] 清理远程旧前端..."
ssh $REMOTE "rm -rf $REMOTE_CLIENT_PATH/*"

echo "🚚 [4/6] 上传前端构建..."
rsync -avz --delete $LOCAL_CLIENT_BUILD_DIR/ $REMOTE:$REMOTE_CLIENT_PATH/

echo "🚚 [5/6] 上传后端（排除 node_modules）..."
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.git' \
  ./signleader-backend/ $REMOTE:$REMOTE_SERVER_PATH/

echo "🚚 [5.1/6] 上传 ecosystem.config.js..."
rsync -avz ecosystem.config.js $REMOTE:$REMOTE_ECOSYSTEM_PATH

echo "🔧 [5.2/6] 上传 nginx 配置并重载..."
rsync -avzL nginx/signleader-management.conf $REMOTE:$REMOTE_NGINX_CONF
ssh $REMOTE "/www/server/nginx/sbin/nginx -s reload"

echo "🚀 [6/6] 重启后端服务 (使用 ecosystem.config.js)..."
ssh $REMOTE "
  cd $REMOTE_SERVER_PATH &&
  npm install &&
  pm2 startOrRestart $REMOTE_ECOSYSTEM_PATH
"

echo "✅ 部署完成！访问前端 ➜ http://$REMOTE_HOST/"
echo "🌐 或绑定域名：http://signleader-management.duckdns.org"
