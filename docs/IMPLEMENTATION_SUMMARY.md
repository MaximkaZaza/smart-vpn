# ✅ Реализация Multi-Server VPN Management

## 📋 Реализованный функционал

### 1. Авторазвертывание серверов ✅

**Сервис:** `src/services/server-deployment.service.js`

**Возможности:**
- ✅ Подключение по SSH к серверу
- ✅ Автомическая установка Docker
- ✅ Генерация и настройка Xray конфигурации
- ✅ Создание Docker Compose файлов
- ✅ Установка Nginx как reverse proxy
- ✅ Получение SSL сертификатов (Let's Encrypt)
- ✅ Настройка firewall (UFW)
- ✅ Добавление/удаление клиентов на сервер

**Использование:**
```javascript
const deploymentService = require('./services/server-deployment.service');

// Развернуть один сервер
await deploymentService.deployServer({
  ipAddress: '185.123.45.67',
  username: 'root',
  password: 'password',
  domain: 'nl1.vpn.example.com'
});

// Развернуть несколько серверов
await deploymentService.deployMultipleServers(serversArray);
```

---

### 2. API для управления серверами ✅

**Файл:** `src/routes/admin.routes.js`

**Endpoints:**

| Endpoint | Описание |
|----------|----------|
| `GET /api/admin/servers` | Получить все серверы |
| `POST /api/admin/servers` | Добавить сервер с авторазвертыванием |
| `POST /api/admin/servers/deploy-multiple` | Массовое развёртывание |
| `PUT /api/admin/servers/:id` | Обновить сервер |
| `DELETE /api/admin/servers/:id` | Удалить сервер |
| `POST /api/admin/servers/:id/health-check` | Проверить здоровье |
| `POST /api/admin/servers/:id/restart` | Перезапустить сервер |
| `POST /api/admin/servers/:id/add-client` | Добавить клиента |
| `POST /api/admin/servers/:id/remove-client` | Удалить клиента |
| `GET /api/admin/servers/health-stats` | Статистика здоровья |

**Пример добавления сервера:**
```bash
curl -X POST http://localhost:3000/api/admin/servers \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Netherlands-1",
    "region": "Europe",
    "country": "Netherlands",
    "ipAddress": "185.123.45.67",
    "sshUsername": "root",
    "sshPassword": "password"
  }'
```

---

### 3. Выбор сервера клиентом ✅

**Файл:** `src/routes/subscription.routes.js`

**Возможности:**
- ✅ Просмотр доступных серверов
- ✅ Выбор сервера при покупке
- ✅ Автовыбор лучшего сервера (наименьшая нагрузка)
- ✅ Смена сервера для активной подписки
- ✅ Учёт нагрузки сервера

**Endpoints для клиентов:**

| Endpoint | Описание |
|----------|----------|
| `GET /api/subscriptions/servers` | Получить доступные серверы |
| `POST /api/subscriptions/activate` | Активировать с выбором сервера |
| `PUT /api/subscriptions/:id/change-server` | Сменить сервер |

**Пример выбора сервера:**
```javascript
// Получить серверы
const servers = await axios.get('/api/subscriptions/servers', {
  headers: { 'Authorization': 'Bearer TOKEN' }
});

// Активировать с выбором сервера
await axios.post('/api/subscriptions/activate', {
  planId: 'plan-uuid',
  serverId: 'server-uuid' // Опционально
});

// Сменить сервер
await axios.put('/api/subscriptions/SUB_ID/change-server', {
  serverId: 'new-server-uuid'
});
```

---

### 4. Health-monitoring ✅

**Сервис:** `src/services/server-health.service.js`

**Возможности:**
- ✅ Автоматическая проверка каждую минуту
- ✅ Проверка API health (порт 3000)
- ✅ Проверка Xray health (порт 443)
- ✅ Измерение response time
- ✅ Обновление метрик сервера
- ✅ Auto-healing (перезапуск нерабочих серверов)
- ✅ Статистика и алерты

**Автоматический запуск:**
```javascript
// В src/index.js
if (process.env.NODE_ENV === 'production') {
  healthMonitor.start();
}
```

**Статусы сервера:**
- `healthy` — работает нормально
- `degraded` — работает с проблемами
- `unhealthy` — недоступен
- `unknown` — не проверен

---

### 5. Telegram-бот с выбором серверов ✅

**Файл:** `src/bot/index.js`

**Возможности:**
- ✅ Показ доступных серверов при покупке
- ✅ Выбор конкретного сервера
- ✅ Автовыбор лучшего сервера
- ✅ Отправка конфигурации с указанием сервера
- ✅ Поддержка сессий для выбора

**Сценарий покупки:**
1. Пользователь выбирает тариф
2. Бот показывает доступные серверы (если их > 1)
3. Пользователь выбирает сервер или автовыбор
4. Бот активирует подписку на выбранном сервере
5. Отправляет QR-код и VLESS ссылку

---

### 6. Модель данных ✅

**Файл:** `src/models/Server.js`

**Поля:**
```javascript
{
  id: UUID,
  name: STRING,           // "Netherlands-1"
  region: STRING,         // "Europe"
  country: STRING,        // "Netherlands"
  ipAddress: STRING,      // "185.123.45.67"
  port: INTEGER,          // 443
  protocol: ENUM,         // "VLESS"
  isActive: BOOLEAN,      // true
  isPrimary: BOOLEAN,     // false
  healthStatus: ENUM,     // "healthy"
  lastHealthCheck: DATE,  // автоматически обновляется
  maxConnections: INTEGER,// 1000
  currentConnections: INTEGER, // автоматически
  loadPercentage: FLOAT,  // автоматически
  config: JSONB,          // SSH credentials
  metrics: JSONB          // статистика
}
```

**Subscription обновлена:**
```javascript
{
  // ...
  serverId: UUID,  // связь с Server
  // ...
}
```

---

## 📊 Архитектура системы

```
┌─────────────────────────────────────────────────────────┐
│                  Admin Panel (Web)                       │
│  /api/admin/servers - управление серверами              │
└────────────────────┬────────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────────┐
│                  API Server (Node.js)                    │
│  - Health Monitor (каждую минуту)                       │
│  - Server Deployment Service                            │
│  - Load Balancing                                       │
└────┬──────────────────┬──────────────────┬──────────────┘
     │                  │                  │
┌────▼─────┐    ┌──────▼──────┐   ┌──────▼──────┐
│ Server 1 │    │   Server 2  │   │   Server N  │
│   NL     │    │     DE      │   │     US      │
│ Xray +   │    │  Xray +     │   │  Xray +     │
│  API     │    │   API       │   │   API       │
└──────────┘    └─────────────┘   └─────────────┘
```

---

## 🚀 Как добавить 10 серверов

### Через API (массовое развёртывание)

```javascript
const servers = [
  { name: 'NL-1', region: 'Europe', country: 'Netherlands', ipAddress: '185.123.45.67' },
  { name: 'NL-2', region: 'Europe', country: 'Netherlands', ipAddress: '185.123.45.68' },
  { name: 'DE-1', region: 'Europe', country: 'Germany', ipAddress: '185.222.33.44' },
  { name: 'DE-2', region: 'Europe', country: 'Germany', ipAddress: '185.222.33.45' },
  { name: 'US-1', region: 'North America', country: 'USA', ipAddress: '45.67.89.101' },
  { name: 'US-2', region: 'North America', country: 'USA', ipAddress: '45.67.89.102' },
  { name: 'UK-1', region: 'Europe', country: 'United Kingdom', ipAddress: '78.90.12.34' },
  { name: 'FR-1', region: 'Europe', country: 'France', ipAddress: '89.12.34.56' },
  { name: 'JP-1', region: 'Asia', country: 'Japan', ipAddress: '123.45.67.89' },
  { name: 'SG-1', region: 'Asia', country: 'Singapore', ipAddress: '234.56.78.90' }
];

// POST /api/admin/servers/deploy-multiple
{
  "servers": servers.map(s => ({
    ...s,
    sshUsername: 'root',
    sshPassword: 'YOUR_PASSWORD'
  }))
}
```

### Результат:
- ✅ 10 серверов будут автоматически развёрнуты
- ✅ Xray установлен и настроен на каждом
- ✅ SSL сертификаты получены
- ✅ Серверы добавлены в базу данных
- ✅ Health monitoring запущен

---

## 👤 Сценарий покупки клиентом

### 1. Клиент видит серверы

```
Бот: 💰 Доступные тарифы:
     1. Optimal — 799 RUB
        📦 200 GB | 📱 2 устройства

🌍 Доступные серверы: 10
   • Netherlands-1 (Netherlands) - загрузка 25%
   • Germany-1 (Germany) - загрузка 45%
   • USA-1 (United States) - загрузка 12%

[Выбрать тариф] [Выбрать сервер]
```

### 2. Выбор сервера

```
Бот: 🌍 Выберите сервер:
     Серверы с наименьшей нагрузкой обеспечат лучшую скорость.

[🇳🇱 Netherlands-1] [🇩🇪 Germany-1] [🇺🇸 USA-1]
[⚡ Автовыбор]
```

### 3. Активация

```
Бот: ✅ Подписка активирована!
     
     Тариф: Optimal
     Сервер: Netherlands-1 (Netherlands)
     Срок: 30 дн.
     Трафик: 200 GB

     Отправляю конфигурацию...
     
[QR-код]
vless://uuid@185.123.45.67:443?...
```

---

## 📈 Мониторинг

### Дашборд администратора

```
GET /api/admin/servers/health-stats

{
  "stats": {
    "total": 10,
    "healthy": 9,
    "degraded": 1,
    "unhealthy": 0,
    "avgLoad": "28.50",
    "lastCheck": "2024-03-14T12:00:00Z"
  }
}
```

### Визуализация:

```
┌────────────────────────────────────────────┐
│  Server Health Dashboard                   │
├────────────────────────────────────────────┤
│  📊 Total: 10 servers                      │
│  ✅ Healthy: 9                             │
│  ⚠️  Degraded: 1                           │
│  ❌ Unhealthy: 0                           │
│                                            │
│  📈 Average Load: 28.5%                    │
│  👥 Total Clients: 2,450                   │
│  🔄 Last Check: 1 min ago                  │
└────────────────────────────────────────────┘
```

---

## 🔐 Безопасность

### SSH Credentials
- Хранятся в `config` поле (JSONB)
- Доступны только superadmin
- Не передаются клиенту
- Используются только для развёртывания

### Server Access
- Только администраторы управляют серверами
- Клиенты видят только публичную информацию
- IP адреса скрыты от клиентов

### Auto-healing
- Только для `unhealthy` серверов
- Требует подтверждения администратора
- Полное логирование

---

## 📁 Созданные файлы

| Файл | Назначение | Статус |
|------|------------|--------|
| `src/services/server-deployment.service.js` | Авторазвертывание | ✅ |
| `src/services/server-health.service.js` | Health monitoring | ✅ |
| `src/routes/admin.routes.js` | Admin API | ✅ (обновлён) |
| `src/routes/subscription.routes.js` | Client API | ✅ (обновлён) |
| `src/bot/index.js` | Telegram bot | ✅ (обновлён) |
| `src/models/Server.js` | Server model | ✅ |
| `src/index.js` | Main app | ✅ (обновлён) |
| `docs/MULTI_SERVER_GUIDE.md` | Документация | ✅ |

---

## 🎯 Итог

### Реализовано:

✅ **Авторазвертывание серверов** — через SSH с установкой Xray, Docker, Nginx, SSL
✅ **Управление через админку** — добавление, удаление, мониторинг, перезапуск
✅ **Выбор сервера клиентом** — при покупке и смена в любой момент
✅ **Мульти-серверная архитектура** — поддержка 10+ серверов
✅ **Health monitoring** — автоматический каждую минуту
✅ **Балансировка нагрузки** — автовыбор сервера с наименьшей нагрузкой
✅ **Auto-healing** — перезапуск нерабочих серверов
✅ **Telegram-бот** — с выбором серверов

### Можно делать:

1. **Добавить 10 серверов через API:**
   ```bash
   curl -X POST /api/admin/servers/deploy-multiple ...
   ```

2. **Клиенты могут выбирать серверы:**
   - Через Telegram-бота
   - Через API (`GET /api/subscriptions/servers`)

3. **Мониторинг работает автоматически:**
   - Проверка каждую минуту
   - Обновление метрик
   - Алерты при проблемах

---

**ВСЁ ГОТОВО К ИСПОЛЬЗОВАНИЮ!** 🚀
