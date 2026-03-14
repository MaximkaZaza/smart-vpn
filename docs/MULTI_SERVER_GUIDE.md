# Multi-Server VPN Management — Руководство

## 📋 Обзор функциональности

Система поддерживает управление несколькими VPN серверами с автоматическим развёртыванием, мониторингом и выбором сервера клиентами.

### Возможности

✅ **Авторазвертывание серверов** — автоматическая установка Xray через SSH
✅ **Мульти-серверная архитектура** — поддержка 10+ серверов
✅ **Выбор сервера клиентом** — при покупке и смена в любой момент
✅ **Health monitoring** — автоматический мониторинг здоровья серверов
✅ **Балансировка нагрузки** — автовыбор сервера с наименьшей нагрузкой
✅ **Auto-healing** — автоматический перезапуск нерабочих серверов
✅ **Админ-панель** — управление всеми серверами через API

---

## 🚀 Добавление серверов через админ-панель

### API Endpoints

#### 1. Добавить один сервер с авторазвертыванием

```http
POST /api/admin/servers
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "name": "Netherlands-1",
  "region": "Europe",
  "country": "Netherlands",
  "ipAddress": "185.123.45.67",
  "port": 443,
  "sshUsername": "root",
  "sshPassword": "server_password",
  "sshPort": 22,
  "domain": "nl1.vpn.example.com",
  "adminEmail": "admin@example.com",
  "dbHost": "main-db.example.com",
  "dbPassword": "db_password"
}
```

**Ответ:**
```json
{
  "success": true,
  "data": {
    "server": {
      "id": "uuid",
      "name": "Netherlands-1",
      "region": "Europe",
      "country": "Netherlands",
      "ipAddress": "185.123.45.67",
      "healthStatus": "healthy"
    },
    "deployment": {
      "success": true,
      "message": "Server deployed successfully"
    }
  }
}
```

#### 2. Добавить несколько серверов одновременно

```http
POST /api/admin/servers/deploy-multiple
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "servers": [
    {
      "name": "Germany-1",
      "region": "Europe",
      "country": "Germany",
      "ipAddress": "185.111.222.33",
      "sshUsername": "root",
      "sshPassword": "password123"
    },
    {
      "name": "USA-1",
      "region": "North America",
      "country": "United States",
      "ipAddress": "45.67.89.101",
      "sshUsername": "root",
      "sshPassword": "password456"
    },
    {
      "name": "Japan-1",
      "region": "Asia",
      "country": "Japan",
      "ipAddress": "123.45.67.89",
      "sshUsername": "root",
      "sshPassword": "password789"
    }
  ]
}
```

#### 3. Получить все серверы

```http
GET /api/admin/servers
Authorization: Bearer <admin_token>
```

#### 4. Проверить здоровье сервера

```http
POST /api/admin/servers/:id/health-check
Authorization: Bearer <admin_token>
```

#### 5. Перезапустить нерабочий сервер

```http
POST /api/admin/servers/:id/restart
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "sshCredentials": {
    "username": "root",
    "password": "server_password"
  }
}
```

---

## 👤 Выбор сервера клиентом

### API Endpoints для клиентов

#### 1. Получить доступные серверы

```http
GET /api/subscriptions/servers
Authorization: Bearer <user_token>
```

**Ответ:**
```json
{
  "success": true,
  "data": {
    "servers": [
      {
        "id": "uuid-1",
        "name": "Netherlands-1",
        "region": "Europe",
        "country": "Netherlands",
        "loadPercentage": 25.5,
        "maxConnections": 1000,
        "currentConnections": 255
      },
      {
        "id": "uuid-2",
        "name": "Germany-1",
        "region": "Europe",
        "country": "Germany",
        "loadPercentage": 45.2,
        "maxConnections": 1000,
        "currentConnections": 452
      },
      {
        "id": "uuid-3",
        "name": "USA-1",
        "region": "North America",
        "country": "United States",
        "loadPercentage": 12.8,
        "maxConnections": 1000,
        "currentConnections": 128
      }
    ]
  }
}
```

#### 2. Активировать подписку с выбором сервера

```http
POST /api/subscriptions/activate
Authorization: Bearer <user_token>
Content-Type: application/json

{
  "planId": "plan-uuid",
  "serverId": "server-uuid" // Опционально - если не указано, выберется лучший сервер
}
```

#### 3. Сменить сервер для подписки

```http
PUT /api/subscriptions/:id/change-server
Authorization: Bearer <user_token>
Content-Type: application/json

{
  "serverId": "new-server-uuid"
}
```

#### 4. Получить конфигурацию VPN

```http
GET /api/subscriptions/config
Authorization: Bearer <user_token>
```

**Ответ:**
```json
{
  "success": true,
  "data": {
    "vless": {
      "v": "2",
      "ps": "Netherlands-1 - Optimal",
      "add": "185.123.45.67",
      "port": "443",
      "id": "client-uuid",
      "security": "tls"
    },
    "qrCode": "data:image/png;base64,...",
    "link": "vless://uuid@185.123.45.67:443?encryption=none&security=tls...",
    "server": {
      "name": "Netherlands-1",
      "region": "Europe",
      "country": "Netherlands"
    }
  }
}
```

---

## 🔧 Автоматическое развёртывание сервера

### Что делает скрипт развёртывания:

1. **Подключение по SSH** к серверу
2. **Обновление системы**: `apt-get update && apt-get upgrade`
3. **Установка Docker** (если не установлен)
4. **Создание директорий**: `/opt/xray/config`, `/opt/xray/certs`
5. **Генерация конфига Xray** с настройками
6. **Создание docker-compose.yml** для запуска
7. **Запуск Xray** через Docker Compose
8. **Установка Nginx** как reverse proxy
9. **Настройка Firewall** (UFW)
10. **Получение SSL сертификата** (Let's Encrypt)
11. **Проверка здоровья** API

### Структура конфига Xray:

```json
{
  "log": { "loglevel": "warning" },
  "inbounds": [
    {
      "port": 443,
      "protocol": "vless",
      "settings": {
        "clients": [],
        "fallbacks": [{ "dest": 80 }]
      },
      "streamSettings": {
        "network": "tcp",
        "security": "tls"
      }
    }
  ],
  "outbounds": [
    { "protocol": "freedom", "tag": "direct" },
    { "protocol": "blackhole", "tag": "blocked" }
  ]
}
```

---

## 📊 Health Monitoring

### Автоматический мониторинг

Система проверяет каждый сервер каждую минуту:

- **API Health** — доступность API на порту 3000
- **Xray Health** — доступность порта 443
- **Response Time** — время отклика
- **Load Percentage** — процент загрузки сервера

### Статусы сервера:

| Статус | Описание |
|--------|----------|
| `healthy` | Сервер работает нормально |
| `degraded` | Сервер работает, но с проблемами (высокий ping) |
| `unhealthy` | Сервер недоступен |
| `unknown` | Статус не известен (первая проверка) |

### Получить статистику здоровья:

```http
GET /api/admin/servers/health-stats
Authorization: Bearer <admin_token>
```

**Ответ:**
```json
{
  "success": true,
  "data": {
    "stats": {
      "total": 10,
      "healthy": 8,
      "degraded": 1,
      "unhealthy": 1,
      "avgLoad": "35.50",
      "lastCheck": "2024-03-14T12:00:00Z"
    }
  }
}
```

---

## 🎯 Сценарии использования

### Сценарий 1: Добавление 10 серверов

```javascript
// Через админ-панель
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

// Массовое развёртывание
POST /api/admin/servers/deploy-multiple
{
  "servers": servers.map(s => ({
    ...s,
    sshUsername: 'root',
    sshPassword: 'your_password'
  }))
}
```

### Сценарий 2: Клиент выбирает сервер

```javascript
// 1. Клиент получает доступные серверы
GET /api/subscriptions/servers

// 2. Выбирает сервер с наименьшей нагрузкой
const bestServer = servers.reduce((best, current) => 
  current.loadPercentage < best.loadPercentage ? current : best
);

// 3. Активирует подписку с выбранным сервером
POST /api/subscriptions/activate
{
  "planId": "plan-uuid",
  "serverId": bestServer.id
}

// 4. Получает конфигурацию
GET /api/subscriptions/config
```

### Сценарий 3: Авто-выбор лучшего сервера

```javascript
// Если serverId не указан, система автоматически выберет лучший сервер
POST /api/subscriptions/activate
{
  "planId": "plan-uuid"
  // serverId не указан - система выберет автоматически
}

// Критерии выбора:
// 1. Наименьший loadPercentage
// 2. healthStatus = 'healthy'
// 3. isActive = true
```

### Сценарий 4: Миграция на другой сервер

```javascript
// Клиент хочет сменить сервер
PUT /api/subscriptions/:id/change-server
{
  "serverId": "new-server-uuid"
}

// Система автоматически:
// 1. Удалит клиента со старого сервера
// 2. Добавит клиента на новый сервер
// 3. Обновит конфигурацию
// 4. Вернёт новую VLESS конфигурацию
```

---

## 🔐 Безопасность

### SSH Credentials

- Хранятся в зашифрованном поле `config`
- Доступны только superadmin
- Не передаются клиенту

### Server Access Control

- Только администраторы могут добавлять серверы
- Клиенты видят только публичную информацию (name, region, country, load)
- IP адреса серверов скрыты от клиентов

### Auto-healing

- Перезапуск только для серверов со статусом `unhealthy`
- Требует подтверждения администратора
- Логируется в audit log

---

## 📈 Мониторинг и метрики

### Метрики сервера:

- `currentConnections` — текущее количество подключений
- `maxConnections` — максимальное количество подключений
- `loadPercentage` — процент загрузки
- `healthStatus` — статус здоровья
- `lastHealthCheck` — последняя проверка
- `lastResponseTime` — время отклика

### Дашборд администратора:

```
┌─────────────────────────────────────────┐
│  Server Health Dashboard                │
├─────────────────────────────────────────┤
│  Total Servers: 10                      │
│  Healthy: 8 ✅                          │
│  Degraded: 1 ⚠️                         │
│  Unhealthy: 1 ❌                        │
│                                         │
│  Average Load: 35.5%                    │
│  Total Clients: 2,450                   │
└─────────────────────────────────────────┘
```

---

## 🛠 Примеры кода

### Добавление сервера (Node.js)

```javascript
const axios = require('axios');

async function addServer() {
  const response = await axios.post(
    'http://localhost:3000/api/admin/servers',
    {
      name: 'Netherlands-1',
      region: 'Europe',
      country: 'Netherlands',
      ipAddress: '185.123.45.67',
      sshUsername: 'root',
      sshPassword: 'password123'
    },
    {
      headers: {
        'Authorization': 'Bearer ' + adminToken
      }
    }
  );
  
  console.log('Server added:', response.data);
}
```

### Выбор сервера клиентом (React)

```jsx
function ServerSelection({ onSelect }) {
  const [servers, setServers] = useState([]);
  
  useEffect(() => {
    axios.get('/api/subscriptions/servers', {
      headers: { 'Authorization': 'Bearer ' + token }
    }).then(res => setServers(res.data.data.servers));
  }, []);
  
  return (
    <div>
      <h3>Select Server</h3>
      {servers.map(server => (
        <div key={server.id}>
          <h4>{server.name}</h4>
          <p>{server.country}</p>
          <p>Load: {server.loadPercentage}%</p>
          <button onClick={() => onSelect(server.id)}>
            Select
          </button>
        </div>
      ))}
    </div>
  );
}
```

---

## 📞 Поддержка

При возникновении проблем:

1. Проверьте логи: `docker-compose logs -f api`
2. Проверьте статус серверов: `GET /api/admin/servers/health-stats`
3. Перезапустите нерабочий сервер через админ-панель

**Документация:**
- [API Documentation](./API.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [Server Management](./SERVER_MANAGEMENT.md)
