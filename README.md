# Smart VPN — Умный VPN-сервис

[![CI/CD](https://github.com/yourusername/smart-vpn/actions/workflows/ci.yml/badge.svg)](https://github.com/yourusername/smart-vpn/actions/workflows/ci.yml)
[![License: ISC](https://img.shields.io/badge/License-ISC-yellow.svg)](https://opensource.org/license/isc-license-txt/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)

«Умный» VPN-сервис с мобильными и десктоп-клиентами, работающий на основе **Xray (VLESS)** с автоматическим фейловером, маскировкой трафика под HTTPS и интеграцией с Telegram-ботом.

## 📋 Оглавление

- [Возможности](#-возможности)
- [Технологии](#-технологии)
- [Быстрый старт](#-быстрый-старт)
- [Конфигурация](#-конфигурация)
- [API Документация](#-api-документация)
- [Telegram-бот](#telegram-бот)
- [Разработка](#-разработка)
- [Деплой](#-деплой)
- [Мониторинг](#-мониторинг)
- [Лицензия](#-лицензия)

## ✨ Возможности

### Для пользователей

- 🚀 **Быстрое подключение** — VLESS с XTLS для максимальной скорости
- 📱 **Мультиплатформенность** — поддержка Android, iOS, Windows, macOS
- 💳 **Гибкая оплата** — карты, криптовалюта, рекуррентные платежи
- 🎁 **Реферальная система** — бонусы за приглашённых друзей
- 📊 **Личный кабинет** — управление подпиской и балансом
- 🤖 **Telegram-бот** — быстрая активация и управление

### Для администраторов

- 🔧 **Админ-панель** — управление пользователями, серверами, тарифами
- 📈 **Мониторинг** — Prometheus + Grafana дашборды
- 🔄 **Автоматический фейловер** — переключение на резервные серверы
- 🎯 **Маршрутизация** — российский трафик через локальные серверы
- 🔐 **WARP и белые списки** — гибкая настройка доступа
- 📝 **Логирование** — централизованный сбор логов

## 🛠 Технологии

### Backend

- **Node.js** + Express — серверная платформа
- **PostgreSQL** — основная база данных
- **Redis** — кэширование и сессии
- **Sequelize** — ORM для работы с БД
- **JWT** — аутентификация и авторизация

### VPN

- **Xray Core** — ядро VPN-сервера
- **VLESS + XTLS** — современный протокол с маскировкой
- **WireGuard/WARP** — резервный протокол

### Frontend & Bot

- **Telegraf** — фреймворк для Telegram-бота
- **React/Vue** — веб-интерфейс (опционально)

### DevOps

- **Docker** + Docker Compose — контейнеризация
- **GitHub Actions** — CI/CD пайплайны
- **Prometheus** + **Grafana** — мониторинг
- **Nginx** — reverse proxy

## 🚀 Быстрый старт

### Требования

- Node.js >= 18.0.0
- PostgreSQL >= 15
- Redis >= 7
- Docker (опционально)

### Установка зависимостей

```bash
npm install
```

### Настройка окружения

```bash
cp .env.example .env
# Отредактируйте .env и укажите ваши параметры
```

### Запуск в development режиме

```bash
npm run dev
```

### Запуск в production режиме

```bash
npm start
```

### Запуск с Docker Compose

```bash
# Сборка и запуск всех сервисов
docker-compose up -d

# Просмотр логов
docker-compose logs -f

# Остановка
docker-compose down
```

## ⚙️ Конфигурация

### Переменные окружения

| Переменная | Описание | По умолчанию |
|------------|----------|--------------|
| `NODE_ENV` | Режим работы | `development` |
| `PORT` | Порт API сервера | `3000` |
| `DB_HOST` | Хост PostgreSQL | `localhost` |
| `DB_PORT` | Порт PostgreSQL | `5432` |
| `DB_NAME` | Имя базы данных | `vpn_db` |
| `DB_USER` | Пользователь БД | `vpn_user` |
| `DB_PASSWORD` | Пароль БД | — |
| `JWT_SECRET` | Секрет JWT токенов | — |
| `TELEGRAM_BOT_TOKEN` | Токен Telegram-бота | — |
| `XRAY_SERVER_PORT` | Порт VPN сервера | `443` |
| `XRAY_TLS_DOMAIN` | Домен для TLS | — |

Полный список в файле `.env.example`.

## 📡 API Документация

### Аутентификация

```bash
# Регистрация
POST /api/auth/register
{
  "username": "user",
  "email": "user@example.com",
  "password": "password123"
}

# Вход
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password123"
}
```

### Пользователь

```bash
# Получить профиль
GET /api/users/me
Authorization: Bearer <token>

# Получить баланс
GET /api/users/balance
Authorization: Bearer <token>

# Рефералы
GET /api/users/referrals
Authorization: Bearer <token>
```

### Подписки

```bash
# Получить подписки
GET /api/subscriptions
Authorization: Bearer <token>

# Активная подписка
GET /api/subscriptions/active
Authorization: Bearer <token>

# Конфигурация VPN
GET /api/subscriptions/config
Authorization: Bearer <token>

# Активировать подписку
POST /api/subscriptions/activate
{
  "planId": "uuid"
}
```

### Тарифы

```bash
# Все тарифы
GET /api/plans

# Конкретный тариф
GET /api/plans/:id
```

### Платежи

```bash
# Создать платёж
POST /api/payments/create
{
  "amount": 500,
  "currency": "RUB",
  "method": "card"
}

# Подтвердить платёж
POST /api/payments/confirm
{
  "transactionId": "uuid",
  "paymentData": {...}
}

# История платежей
GET /api/payments/history
Authorization: Bearer <token>
```

## 🤖 Telegram-бот

### Команды

- `/start` — Запуск бота, регистрация
- `/menu` — Главное меню
- `/balance` — Проверка баланса
- `/subscription` — Информация о подписке

### Кнопки меню

- 💰 **Тарифы** — Выбор и покупка тарифа
- 👤 **Мой аккаунт** — Информация о профиле
- 🔑 **Подключить VPN** — Получение конфигурации
- 💳 **Пополнить баланс** — Пополнение счёта
- 📞 **Поддержка** — Контакты поддержки
- ℹ️ **Помощь** — Инструкция по использованию

## 👨‍💻 Разработка

### Запуск тестов

```bash
# Все тесты
npm test

# Тесты в режиме watch
npm run test:watch

# E2E тесты
npm run test:e2e

# С отчётом о покрытии
npm run ci:test
```

### Линтинг

```bash
# Проверка
npm run lint

# Автоисправление
npm run lint:fix
```

### Структура проекта

```
VPN/
├── src/
│   ├── bot/              # Telegram-бот
│   ├── config/           # Конфигурация
│   ├── middleware/       # Express middleware
│   ├── models/           # Sequelize модели
│   ├── routes/           # API маршруты
│   ├── services/         # Бизнес-логика
│   ├── utils/            # Утилиты
│   └── index.js          # Точка входа
├── tests/                # Тесты
├── config/               # Конфигурационные файлы
│   ├── nginx/            # Nginx конфиги
│   ├── xray/             # Xray конфиги
│   ├── prometheus/       # Prometheus конфиги
│   └── grafana/          # Grafana дашборды
├── docker-compose.yml    # Docker Compose
├── Dockerfile            # Docker образ
└── .github/workflows/    # CI/CD пайплайны
```

## 🚢 Деплой

### Production чеклист

1. ✅ Настроить `.env` для production
2. ✅ Сгенерировать SSL сертификаты (Let's Encrypt)
3. ✅ Настроить firewall и security groups
4. ✅ Включить rate limiting
5. ✅ Настроить бэкапы БД
6. ✅ Настроить мониторинг и алерты

### Docker Compose (production)

```bash
# Сборка образов
docker-compose build

# Запуск
docker-compose -f docker-compose.yml up -d

# Проверка статуса
docker-compose ps

# Логи
docker-compose logs -f api
docker-compose logs -f bot
```

### Kubernetes (опционально)

Для развёртывания в Kubernetes используйте Helm чарты или манифесты в директории `k8s/`.

## 📊 Мониторинг

### Prometheus

Метрики доступны по адресу: `http://localhost:9090`

### Grafana

Дашборды доступны по адресу: `http://localhost:3001`

- Логин: `admin`
- Пароль: `admin` (измените в production!)

### Ключевые метрики

- `http_request_duration_seconds` — время обработки запросов
- `active_connections` — активные подключения
- `vpn_connections_total` — всего VPN подключений
- `subscription_active_total` — активных подписок

## 📄 Лицензия

ISC

## 📞 Поддержка

- Email: support@vpn.example.com
- Telegram: @vpn_support
- Документация: `/docs`

---

**Примечание:** Этот проект предназначен для образовательных целей и легального использования. Убедитесь, что вы соблюдаете законодательство вашей страны при использовании VPN.
