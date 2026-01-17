#!/bin/bash
# Deploy script for crossword backend

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REMOTE_USER="sergey"
REMOTE_HOST="mc.skrup.ru"
REMOTE_DIR="~/crossword-backend"

echo "Deploying to $REMOTE_USER@$REMOTE_HOST..."

# Создаём директорию если нет
ssh "$REMOTE_USER@$REMOTE_HOST" "mkdir -p $REMOTE_DIR"

# Синхронизируем только backend папку
rsync -avz --delete \
    --exclude 'node_modules' \
    --exclude '.git' \
    "$SCRIPT_DIR/" "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/"

# Устанавливаем зависимости и перезапускаем
ssh "$REMOTE_USER@$REMOTE_HOST" << 'EOF'
    cd ~/crossword-backend
    npm install --production

    # Проверяем pm2
    if ! command -v pm2 &> /dev/null; then
        npm install -g pm2
    fi

    # Перезапускаем сервер
    pm2 delete crossword-api 2>/dev/null || true
    pm2 start server.js --name crossword-api
    pm2 save

    echo "Backend deployed and running!"
    pm2 status crossword-api
EOF
