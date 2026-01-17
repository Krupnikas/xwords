#!/bin/bash

# Скрипт для запуска тестов

cd "$(dirname "$0")"

# Создаём виртуальное окружение если нет
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Активируем и устанавливаем зависимости
source venv/bin/activate
pip install -q -r requirements.txt

# Создаём папку для скриншотов
mkdir -p screenshots

# Проверяем что сервер запущен
if ! curl -s http://localhost:3000 > /dev/null; then
    echo "Error: Server is not running on http://localhost:3000"
    echo "Please start the server first: cd ../backend && npm start"
    exit 1
fi

# Запускаем тесты
echo "Running tests..."
pytest test_crossword.py -v --tb=short

echo ""
echo "Screenshots saved to: $(pwd)/screenshots/"
