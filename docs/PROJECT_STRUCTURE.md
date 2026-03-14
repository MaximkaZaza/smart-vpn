# Структура проекта Smart VPN

```
VPN/
├── .github/
│   └── workflows/
│       └── ci.yml                    # CI/CD пайплайн (GitHub Actions)
├── config/
│   ├── grafana/
│   │   ├── dashboards/               # Grafana дашборды
│   │   └── provisioning/             # Grafana provisioning
│   ├── nginx/
│   │   └── default.conf              # Nginx конфигурация
│   ├── prometheus/
│   │   └── prometheus.yml            # Prometheus конфигурация
│   └── xray/
│       └── config.json               # Xray VPN конфигурация
├── docs/
│   ├── ARCHITECTURE.md               # Архитектура системы
│   ├── DEPLOYMENT.md                 # Руководство по развёртыванию
│   └── QUICKSTART.md                 # Быстрый старт
├── src/
│   ├── bot/
│   │   └── index.js                  # Telegram бот
│   ├── config/
│   │   ├── database.js               # Конфигурация БД
│   │   └── logger.js                 # Конфигурация логгера
│   ├── database/
│   │   ├── init/
│   │   │   └── 001-initial-schema.sql # SQL схема БД
│   │   ├── migrate.js                # Скрипт миграции
│   │   └── seed.js                   # Скрипт заполнения БД
│   ├── middleware/
│   │   ├── auth.js                   # Auth middleware
│   │   ├── errorHandler.js           # Error handler
│   │   └── logger.js                 # Request logger
│   ├── models/
│   │   ├── index.js                  # Экспорт моделей
│   │   ├── Plan.js                   # Plan модель
│   │   ├── Server.js                 # Server модель
│   │   ├── Subscription.js           # Subscription модель
│   │   ├── Transaction.js            # Transaction модель
│   │   └── User.js                   # User модель
│   ├── routes/
│   │   ├── admin.routes.js           # Admin API
│   │   ├── auth.routes.js            # Auth API
│   │   ├── index.js                  # Роутинг
│   │   ├── payment.routes.js         # Payment API
│   │   ├── plan.routes.js            # Plan API
│   │   ├── server.routes.js          # Server API
│   │   ├── subscription.routes.js    # Subscription API
│   │   └── user.routes.js            # User API
│   ├── scripts/
│   │   └── create-admin.js           # Скрипт создания админа
│   ├── services/
│   │   ├── payment.service.js        # Payment сервис
│   │   └── xray.service.js           # Xray сервис (VLESS config)
│   ├── utils/
│   │   ├── backup.js                 # Backup утилита
│   │   └── bot.helpers.js            # Bot helpers
│   ├── healthcheck.js                # Health check endpoint
│   └── index.js                      # Главный файл приложения
├── tests/
│   ├── e2e/
│   │   └── flow.test.js              # E2E тесты
│   ├── api.test.js                   # API тесты
│   ├── models.test.js                # Модельные тесты
│   └── setup.js                      # Test setup
├── .dockerignore                     # Docker ignore
├── .env.example                      # Пример окружения
├── .eslintrc.js                      # ESLint конфигурация
├── .gitignore                        # Git ignore
├── docker-compose.yml                # Docker Compose
├── Dockerfile                        # Docker образ
├── jest.config.js                    # Jest конфигурация
├── jest.e2e.config.js                # Jest E2E конфигурация
├── package.json                      # npm конфигурация
├── package-lock.json                 # npm lock файл
├── project.md                        # Спецификация проекта
├── steps.md                          # План реализации
├── QWEN.md                           # Контекст проекта
└── README.md                         # Основная документация
```

## Ключевые файлы

### Конфигурация

| Файл | Описание |
|------|----------|
| `package.json` | Зависимости и npm скрипты |
| `.env.example` | Шаблон переменных окружения |
| `docker-compose.yml` | Docker сервисы (API, Bot, DB, Xray, Monitoring) |
| `config/xray/config.json` | Конфигурация VPN сервера |
| `config/nginx/default.conf` | Reverse proxy конфигурация |

### Приложение

| Файл | Описание |
|------|----------|
| `src/index.js` | Точка входа Express сервера |
| `src/bot/index.js` | Telegram бот |
| `src/models/*.js` | Sequelize модели данных |
| `src/routes/*.js` | API endpoints |
| `src/services/*.js` | Бизнес-логика |

### База данных

| Файл | Описание |
|------|----------|
| `src/database/init/001-initial-schema.sql` | SQL схема БД |
| `src/database/migrate.js` | Применение миграций |
| `src/database/seed.js` | Заполнение начальными данными |

### Тесты

| Файл | Описание |
|------|----------|
| `tests/api.test.js` | Unit тесты API |
| `tests/models.test.js` | Unit тесты моделей |
| `tests/e2e/flow.test.js` | E2E тесты пользовательского сценария |

### DevOps

| Файл | Описание |
|------|----------|
| `.github/workflows/ci.yml` | CI/CD пайплайн |
| `Dockerfile` | Образ приложения |
| `jest.config.js` | Конфигурация тестирования |

## Модули

### API Модули

- **Auth** — Регистрация, вход, JWT токены
- **Users** — Профиль, баланс, рефералы
- **Subscriptions** — Управление подписками
- **Payments** — Платежи, транзакции
- **Plans** — Тарифные планы
- **Servers** — VPN серверы (admin)
- **Admin** — Администрирование

### Сервисы

- **Xray Service** — Генерация VLESS конфигураций
- **Payment Service** — Интеграция с платежными шлюзами

### Bot Команды

- `/start` — Регистрация
- `/menu` — Главное меню
- `/balance` — Баланс
- `/subscription` — Подписка

## Зависимости

### Production

- `express` — Web фреймворк
- `telegraf` — Telegram bot framework
- `sequelize` — ORM
- `pg` — PostgreSQL драйвер
- `jsonwebtoken` — JWT аутентификация
- `bcryptjs` — Хеширование паролей
- `winston` — Логирование
- `prom-client` — Prometheus метрики

### Development

- `jest` — Тестирование
- `supertest` — HTTP тестирование
- `eslint` — Линтинг
- `nodemon` — Auto-reload
