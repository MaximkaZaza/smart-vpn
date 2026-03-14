# Smart VPN — Руководство по запуску

## Быстрый старт (5 минут)

### 1. Установка зависимостей

```bash
npm install
```

### 2. Настройка окружения

```bash
# Скопируйте пример файла окружения
cp .env.example .env

# Отредактируйте .env и укажите минимум:
# - JWT_SECRET (любая случайная строка)
# - TELEGRAM_BOT_TOKEN (получить в @BotFather)
```

### 3. Запуск в development режиме

```bash
# Вариант A: Только API сервер
npm run dev

# Вариант B: Docker Compose (все сервисы)
docker-compose up -d
```

### 4. Инициализация базы данных

```bash
# Применить миграции
npm run db:migrate

# Заполнить начальными данными
npm run db:seed
```

### 5. Создание администратора

```bash
node src/scripts/create-admin.js
```

## Проверка работы

### API Health Check

```bash
curl http://localhost:3000/health
```

Ожидаемый ответ:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.456
}
```

### Metrics

```bash
curl http://localhost:3000/metrics
```

### Telegram Bot

1. Откройте Telegram
2. Найдите вашего бота по токену
3. Нажмите `/start`

## Запуск тестов

```bash
# Unit тесты
npm test

# E2E тесты
npm run test:e2e

# С покрытием
npm run ci:test
```

## Docker Compose

### Запуск всех сервисов

```bash
docker-compose up -d
```

### Просмотр логов

```bash
# Все логи
docker-compose logs -f

# Логи конкретного сервиса
docker-compose logs -f api
docker-compose logs -f bot
```

### Остановка

```bash
docker-compose down
```

### Перезапуск

```bash
docker-compose restart
```

## Структура портов

| Сервис | Порт | Описание |
|--------|------|----------|
| API | 3000 | Express API сервер |
| Bot | - | Telegram бот (webhook) |
| PostgreSQL | 5432 | База данных |
| Redis | 6379 | Кэш |
| Xray | 443 | VPN сервер |
| Prometheus | 9090 | Мониторинг |
| Grafana | 3001 | Дашборды |

## Переменные окружения (минимум)

```ini
# Server
NODE_ENV=development
PORT=3000

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=vpn_db
DB_USER=vpn_user
DB_PASSWORD=vpn_password

# JWT
JWT_SECRET=your_secret_key_here

# Telegram
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz

# Xray
XRAY_SERVER_PORT=443
XRAY_TLS_DOMAIN=localhost
```

## Решение проблем

### Ошибка: "Database connection failed"

1. Проверьте, запущен ли PostgreSQL
2. Проверьте параметры подключения в `.env`
3. Запустите миграции: `npm run db:migrate`

### Ошибка: "JWT_SECRET is required"

Сгенерируйте случайную строку:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Ошибка: "Port 3000 is already in use"

Измените порт в `.env`:
```ini
PORT=3001
```

### Бот не отвечает

1. Проверьте токен бота
2. Установите webhook:
```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-domain.com/telegram/webhook"
```

## Production запуск

```bash
# Сборка
npm install --production

# Настройка .env для production
# - Установите NODE_ENV=production
# - Используйте надёжные пароли
# - Настройте SSL

# Запуск
npm start

# Или через Docker
docker-compose -f docker-compose.yml up -d
```

## Документация

- [README.md](./README.md) — Основная документация
- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — Архитектура системы
- [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) — Развёртывание в production

## Поддержка

При возникновении проблем:

1. Проверьте логи: `docker-compose logs -f`
2. Проверьте статус: `docker-compose ps`
3. Прочитайте документацию в `docs/`

## Следующие шаги

1. ✅ Настроить Telegram-бота (получить токен в @BotFather)
2. ✅ Настроить платежные шлюзы (YooKassa, Stripe)
3. ✅ Получить SSL сертификаты
4. ✅ Развернуть на сервере
5. ✅ Настроить мониторинг и бэкапы
