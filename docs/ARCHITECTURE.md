# Smart VPN — Архитектура системы

## Общая архитектура

```
┌─────────────────────────────────────────────────────────────────┐
│                         Клиенты                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐│
│  │ Android  │  │   iOS    │  │ Windows  │  │     macOS        ││
│  │   App    │  │   App    │  │   App    │  │       App        ││
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬─────────┘│
│       │             │             │                  │           │
│       └─────────────┴─────────────┴──────────────────┘           │
│                              │                                    │
│                    (VLESS Protocol)                              │
└──────────────────────────────┼───────────────────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │   Nginx Reverse     │
                    │      Proxy          │
                    │   (Port 443/TLS)    │
                    └──────────┬──────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
┌────────▼────────┐   ┌────────▼────────┐   ┌──────▼──────┐
│   Xray VPN      │   │   API Server    │   │Telegram Bot │
│    Server       │   │   (Express)     │   │  (Telegraf) │
│  (VLESS/XTLS)   │   │   (Port 3000)   │   │  (Webhook)  │
└────────┬────────┘   └────────┬────────┘   └──────┬──────┘
         │                     │                     │
         │            ┌────────▼────────┐           │
         │            │   PostgreSQL    │◄──────────┘
         │            │   (Database)    │
         │            └────────┬────────┘
         │                     │
         │            ┌────────▼────────┐
         │            │      Redis      │
         │            │    (Cache)      │
         │            └─────────────────┘
         │
┌────────▼────────────────────────────────┐
│     Monitoring & Observability          │
│  ┌──────────────┐  ┌─────────────────┐ │
│  │  Prometheus  │  │     Grafana     │ │
│  │  (Metrics)   │  │   (Dashboards)  │ │
│  └──────────────┘  └─────────────────┘ │
└─────────────────────────────────────────┘
```

## Компоненты системы

### 1. Клиентские приложения

**Поддерживаемые платформы:**
- Android (V2RayNG, Hiddify)
- iOS (Shadowrocket, V2Box)
- Windows (v2rayN, Hiddify)
- macOS (V2RayU, Hiddify)

**Протокол:** VLESS с XTLS Reality
- Порт: 443/TCP
- Маскировка: HTTPS (TLS 1.3)
- Обфускация: XTLS-RPRX-Vision

### 2. Nginx Reverse Proxy

**Функции:**
- Терминация TLS соединений
- Маршрутизация трафика
- Rate limiting
- Защита от DDoS

**Конфигурация:**
- HTTP → HTTPS редирект
- API → Backend (port 3000)
- Telegram Webhook → Bot
- Static files → CDN/Local

### 3. Xray VPN Server

**Протокол:** VLESS с XTLS

**Конфигурация:**
```json
{
  "protocol": "vless",
  "port": 443,
  "security": "tls",
  "clients": [...],
  "fallbacks": [...]
}
```

**Функции:**
- Приём VPN подключений
- Маршрутизация трафика
- Учёт трафика
- Failover (резервирование)

### 4. API Server (Express)

**Основные endpoints:**
- `/api/auth/*` — Аутентификация
- `/api/users/*` — Пользователи
- `/api/subscriptions/*` — Подписки
- `/api/payments/*` — Платежи
- `/api/admin/*` — Администрирование

**Middleware:**
- Helmet (security headers)
- CORS
- Rate limiting
- JWT authentication
- Request logging

### 5. Telegram Bot

**Команды:**
- `/start` — Регистрация
- `/menu` — Главное меню
- `/balance` — Баланс
- `/subscription` — Подписка

**Функции:**
- Регистрация пользователей
- Продажа подписок
- Выдача конфигураций
- Уведомления
- Поддержка

### 6. База данных (PostgreSQL)

**Таблицы:**
- `users` — Пользователи
- `subscriptions` — Подписки
- `plans` — Тарифные планы
- `transactions` — Транзакции
- `servers` — VPN серверы

**Индексы:**
- По email, telegramId
- По UUID подписок
- По статусам

### 7. Redis

**Использование:**
- Кэширование запросов
- Сессии пользователей
- Rate limiting
- Очереди задач

## Схема данных

```
┌─────────────┐       ┌─────────────────┐
│    Users    │       │      Plans      │
├─────────────┤       ├─────────────────┤
│ id (UUID)   │       │ id (UUID)       │
│ telegramId  │       │ name            │
│ username    │       │ price           │
│ email       │       │ duration        │
│ balance     │       │ trafficLimitGB  │
│ refCode     │       │ deviceLimit     │
│ role        │       └────────┬────────┘
└──────┬──────┘                │
       │                       │
       │  ┌────────────────────┘
       │  │
       │  │  ┌──────────────────┐
       │  │  │  Subscriptions   │
       │  │  ├──────────────────┤
       │  └─►│ id (UUID)        │
       │     │ userId (FK)      │
       │     │ planId (FK)      │
       │     │ vlessUuid        │
       │     │ startDate        │
       │     │ endDate          │
       │     │ isActive         │
       │     └────────┬─────────┘
       │              │
       │     ┌────────┴─────────┐
       │     │    Transactions  │
       │     ├──────────────────┤
       │     │ id (UUID)        │
       │     │ userId (FK)      │
       │     │ amount           │
       │     │ type             │
       │     │ status           │
       │     └──────────────────┘
       │
       │     ┌─────────────────┐
       └────►│   Referrals     │
             │ (self-referencing)
             └─────────────────┘
```

## Поток данных

### Регистрация и покупка подписки

```
1. Пользователь → Telegram Bot: /start
2. Bot → API: POST /auth/telegram
3. API → DB: CREATE USER
4. API → Bot: User created
5. Bot → User: Show tariffs
6. User → Bot: Select tariff
7. Bot → API: POST /payments/create
8. API → Payment Gateway: Create payment
9. Payment Gateway → User: Payment page
10. User → Payment Gateway: Pay
11. Payment Gateway → API: Webhook (success)
12. API → DB: CREATE Transaction
13. API → DB: CREATE Subscription
14. API → Xray: Add client
15. API → Bot: Subscription active
16. Bot → User: Send VPN config (QR)
```

### VPN подключение

```
1. Client → Xray: VLESS handshake (Port 443)
2. Xray → TLS: Decrypt
3. Xray → Auth: Validate UUID
4. Auth → DB: Check subscription
5. DB → Auth: Active subscription
6. Auth → Xray: Allow
7. Xray → Client: Tunnel established
8. Client → Xray → Internet: Traffic flow
```

## Безопасность

### Уровень сети
- Firewall (UFW/iptables)
- DDoS защита
- Rate limiting

### Уровень приложения
- JWT аутентификация
- HTTPS/TLS 1.3
- Хеширование паролей (bcrypt)
- Валидация входных данных

### Уровень данных
- Prepared statements (ORM)
- Шифрование БД (disk)
- Бэкапы

## Масштабирование

### Горизонтальное
- Несколько API серверов (Load Balancer)
- Репликация PostgreSQL
- Redis Cluster

### Вертикальное
- Увеличение CPU/RAM
- SSD для БД
- Оптимизация запросов

### Географическое
- Серверы в разных регионах
- DNS-based routing
- Geo-IP маршрутизация

## Мониторинг

### Метрики (Prometheus)
- HTTP запросы (duration, status)
- Активные подключения
- Использование CPU/RAM
- Latency БД

### Логи (Winston)
- Application logs
- Error logs
- Access logs
- Audit logs

### Алерты
- Падение сервера
- Ошибки аутентификации
- Низкий баланс БД
- Высокая нагрузка

## CI/CD Pipeline

```
┌─────────────┐
│  Git Push   │
└──────┬──────┘
       │
┌──────▼──────┐
│   GitHub    │
│   Actions   │
└──────┬──────┘
       │
  ┌────┴────┐
  │         │
┌─▼───┐  ┌──▼────┐
│Lint │  │ Tests │
└─┬───┘  └───┬───┘
  │          │
  └────┬─────┘
       │
┌──────▼──────┐
│ Build Docker│
└──────┬──────┘
       │
  ┌────┴────┐
  │         │
┌─▼───┐  ┌──▼──────┐
│Staging│ │Production│
└──────┘  └─────────┘
```
