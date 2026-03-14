# Руководство по развёртыванию Smart VPN

## Предварительные требования

### Серверные требования

**Минимальные:**
- CPU: 2 cores
- RAM: 4 GB
- Disk: 40 GB SSD
- OS: Ubuntu 22.04 LTS / Debian 11

**Рекомендуемые:**
- CPU: 4 cores
- RAM: 8 GB
- Disk: 80 GB NVMe SSD
- OS: Ubuntu 22.04 LTS

### Домен и SSL

- Доменное имя (например, `vpn.example.com`)
- SSL сертификат (Let's Encrypt — бесплатно)

## Шаг 1: Подготовка сервера

### Обновление системы

```bash
sudo apt update && sudo apt upgrade -y
```

### Установка зависимостей

```bash
sudo apt install -y \
    curl \
    git \
    docker.io \
    docker-compose \
    nginx \
    certbot \
    python3-certbot-nginx \
    ufw \
    fail2ban
```

### Настройка firewall

```bash
# Разрешить SSH
sudo ufw allow 22/tcp

# Разрешить HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Разрешить VPN порт
sudo ufw allow 443/udp

# Включить firewall
sudo ufw enable
```

## Шаг 2: Установка Docker

```bash
# Добавить пользователя в группу docker
sudo usermod -aG docker $USER

# Проверка установки
docker --version
docker-compose --version
```

## Шаг 3: Клонирование проекта

```bash
cd /opt
sudo git clone https://github.com/yourusername/smart-vpn.git
cd smart-vpn
sudo chown -R $USER:$USER .
```

## Шаг 4: Настройка окружения

### Создание .env файла

```bash
cp .env.example .env
nano .env
```

### Обязательные переменные

```ini
# Server
NODE_ENV=production
PORT=3000

# Database
DB_HOST=postgres
DB_PORT=5432
DB_NAME=vpn_db
DB_USER=vpn_user
DB_PASSWORD=<secure_password>

# JWT
JWT_SECRET=<secure_random_string>

# Telegram
TELEGRAM_BOT_TOKEN=<bot_token_from_botfather>
TELEGRAM_WEBHOOK_URL=https://vpn.example.com/telegram/webhook

# Xray
XRAY_SERVER_PORT=443
XRAY_TLS_DOMAIN=vpn.example.com

# Payments
YOOKASSA_SHOP_ID=<shop_id>
YOOKASSA_SECRET_KEY=<secret_key>
```

### Генерация безопасных паролей

```bash
# Для DB_PASSWORD
openssl rand -base64 32

# Для JWT_SECRET
openssl rand -hex 32

# Для UUID
cat /proc/sys/kernel/random/uuid
```

## Шаг 5: Получение SSL сертификатов

```bash
# Остановить nginx (если запущен)
sudo systemctl stop nginx

# Получить сертификат
sudo certbot certonly --standalone -d vpn.example.com

# Проверить расположение файлов
ls -la /etc/letsencrypt/live/vpn.example.com/
```

### Копирование сертификатов

```bash
sudo mkdir -p config/certs
sudo cp /etc/letsencrypt/live/vpn.example.com/fullchain.pem config/certs/
sudo cp /etc/letsencrypt/live/vpn.example.com/privkey.pem config/certs/
sudo cp /etc/letsencrypt/live/vpn.example.com/chain.pem config/certs/
```

## Шаг 6: Настройка Nginx

### Конфигурация nginx

```bash
sudo nano /etc/nginx/sites-available/vpn
```

```nginx
server {
    listen 80;
    server_name vpn.example.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name vpn.example.com;

    ssl_certificate /etc/letsencrypt/live/vpn.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/vpn.example.com/privkey.pem;
    
    # Security settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    
    # Proxy to API
    location /api/ {
        proxy_pass http://localhost:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Telegram webhook
    location /telegram/webhook {
        proxy_pass http://localhost:3001/telegram/webhook;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Активация конфигурации

```bash
sudo ln -s /etc/nginx/sites-available/vpn /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Шаг 7: Запуск сервисов

### Сборка и запуск

```bash
docker-compose build
docker-compose up -d
```

### Проверка статуса

```bash
docker-compose ps
docker-compose logs -f
```

### Ожидаемый вывод

```
NAME              STATUS         PORTS
vpn_api           Up (healthy)   0.0.0.0:3000->3000/tcp
vpn_bot           Up             3001/tcp
vpn_postgres      Up (healthy)   5432/tcp
vpn_redis         Up (healthy)   6379/tcp
vpn_xray          Up             0.0.0.0:443->443/tcp
vpn_prometheus    Up             9090/tcp
vpn_grafana       Up             3001/tcp
```

## Шаг 8: Настройка Telegram вебхука

```bash
# Установить webhook
curl -X POST "https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://vpn.example.com/telegram/webhook"
```

### Проверка webhook

```bash
curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"
```

## Шаг 9: Инициализация базы данных

```bash
# Запуск миграций
docker-compose exec api npm run db:migrate

# Создание администратора
docker-compose exec api node src/scripts/create-admin.js
```

## Шаг 10: Настройка мониторинга

### Grafana

1. Открыть `http://vpn.example.com:3001` (или через nginx proxy)
2. Логин: `admin`, Пароль: `admin`
3. Изменить пароль
4. Добавить Prometheus datasource: `http://prometheus:9090`
5. Импортировать дашборды из `config/grafana/dashboards/`

### Prometheus

Проверить target'ы: `http://vpn.example.com:9090/targets`

## Шаг 11: Настройка автозапуска

### Создание systemd сервиса

```bash
sudo nano /etc/systemd/system/smart-vpn.service
```

```ini
[Unit]
Description=Smart VPN Service
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/smart-vpn
ExecStart=/usr/bin/docker-compose up -d
ExecStop=/usr/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
```

### Активация сервиса

```bash
sudo systemctl daemon-reload
sudo systemctl enable smart-vpn
sudo systemctl start smart-vpn
sudo systemctl status smart-vpn
```

## Шаг 12: Настройка бэкапов

### Скрипт бэкапа

```bash
sudo nano /opt/smart-vpn/scripts/backup.sh
```

```bash
#!/bin/bash

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/backups/smart-vpn"
mkdir -p $BACKUP_DIR

# Backup PostgreSQL
docker-compose exec -T postgres pg_dump -U vpn_user vpn_db > $BACKUP_DIR/db_$DATE.sql

# Backup configs
tar -czf $BACKUP_DIR/configs_$DATE.tar.gz config/ .env

# Backup to remote server (optional)
# rsync -avz $BACKUP_DIR/ user@backup-server:/backups/smart-vpn/

# Delete old backups (keep 7 days)
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete

echo "Backup completed: $DATE"
```

### Cron job

```bash
sudo crontab -e
```

```
0 2 * * * /opt/smart-vpn/scripts/backup.sh >> /var/log/smart-vpn-backup.log 2>&1
```

## Шаг 13: Настройка логирования

### Rotating logs

```bash
sudo nano /etc/logrotate.d/smart-vpn
```

```
/opt/smart-vpn/logs/*.log {
    daily
    rotate 7
    compress
    delaycompress
    notifempty
    create 0640 root root
    sharedscripts
    postrotate
        systemctl reload smart-vpn > /dev/null 2>&1 || true
    endscript
}
```

## Шаг 14: Финальная проверка

### Health checks

```bash
# API health
curl https://vpn.example.com/health

# Metrics
curl https://vpn.example.com/metrics

# Bot status
docker-compose logs bot | tail -20
```

### Тестовое подключение

1. Зарегистрироваться через бота: `/start`
2. Проверить баланс: `/balance`
3. Купить тариф
4. Получить конфигурацию
5. Подключиться через V2RayNG/Shadowrocket

## Troubleshooting

### Сервис не запускается

```bash
# Проверить логи
docker-compose logs api
docker-compose logs bot

# Перезапустить
docker-compose restart
```

### Ошибки базы данных

```bash
# Проверить подключение
docker-compose exec postgres pg_isready -U vpn_user

# Пересоздать БД (осторожно!)
docker-compose down -v
docker-compose up -d postgres
docker-compose exec api npm run db:migrate
```

### Проблемы с SSL

```bash
# Проверить сертификат
sudo certbot certificates

# Обновить
sudo certbot renew --dry-run
```

### Высокая нагрузка

```bash
# Проверить ресурсы
docker stats

# Проверить логи
docker-compose logs --tail=100
```

## Обновление

```bash
# Остановить сервисы
docker-compose down

# Обновить код
git pull

# Пересобрать образы
docker-compose build

# Запустить
docker-compose up -d

# Применить миграции
docker-compose exec api npm run db:migrate
```

## Безопасность

### Рекомендации

1. Регулярно обновляйте систему
2. Меняйте пароли каждые 90 дней
3. Включите 2FA для SSH
4. Настройте fail2ban
5. Ограничьте доступ к админке по IP
6. Используйте VPN для доступа к серверу

### Fail2ban настройка

```bash
sudo nano /etc/fail2ban/jail.local
```

```ini
[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600
```

## Поддержка

При возникновении проблем:

1. Проверьте логи: `docker-compose logs -f`
2. Проверьте статус: `docker-compose ps`
3. Проверьте ресурсы: `docker stats`
4. Обратитесь в поддержку: support@vpn.example.com
