# Руководство по автоматическому развёртыванию Smart VPN

## 📜 Скрипты автоматизации

Проект включает скрипты для автоматизации развёртывания и управления:

### Для Linux (сервер)

| Скрипт | Назначение |
|--------|------------|
| `setup-server.sh` | Подготовка сервера (установка зависимостей) |
| `deploy.sh` | Полное развёртывание проекта |
| `manage.sh` | Управление сервисами |

### Для Windows (локальная разработка)

| Скрипт | Назначение |
|--------|------------|
| `publish-to-github.bat` | Публикация на GitHub (Batch) |
| `publish-to-github.ps1` | Публикация на GitHub (PowerShell) |

---

## 🚀 Быстрое развёртывание на сервере

### Шаг 1: Аренда сервера

**Требования:**
- ОС: Ubuntu 22.04 LTS
- CPU: 2 cores
- RAM: 4 GB
- Disk: 40 GB SSD

**Рекомендуемые провайдеры:**
- DigitalOcean ($12/мес)
- Hetzner (€5/мес)
- Vultr ($6/мес)
- Aeza (от 200₽/мес)

### Шаг 2: Подключение к серверу

```bash
ssh root@your-server-ip
```

### Шаг 3: Клонирование проекта

```bash
cd /opt
git clone https://github.com/yourusername/smart-vpn.git
cd smart-vpn
```

### Шаг 4: Настройка сервера

```bash
chmod +x setup-server.sh manage.sh deploy.sh
./setup-server.sh
```

**Что делает скрипт:**
- ✅ Обновляет систему
- ✅ Устанавливает Docker и Docker Compose
- ✅ Настраивает Firewall (UFW)
- ✅ Устанавливает Nginx и Certbot
- ✅ Настраивает Fail2Ban
- ✅ Включает автообновления
- ✅ Оптимизирует системные параметры

### Шаг 5: Развёртывание проекта

```bash
./deploy.sh --production
```

**Что делает скрипт:**
- ✅ Клонирует проект (если нужно)
- ✅ Генерирует `.env` файл
- ✅ Получает SSL сертификаты (Let's Encrypt)
- ✅ Настраивает Nginx
- ✅ Запускает Docker сервисы
- ✅ Инициализирует базу данных
- ✅ Настраивает Telegram вебхук

### Шаг 6: Проверка

```bash
./manage.sh status
```

---

## 📋 Использование manage.sh

### Запуск сервисов

```bash
./manage.sh start
```

### Остановка

```bash
./manage.sh stop
```

### Перезапуск

```bash
./manage.sh restart
```

### Редактирование .env

```bash
./manage.sh env:edit
```

**Что делает команда:**
- Показывает текущие значения ключевых параметров
- Предлагает выбрать способ редактирования:
  1. Быстрое редактирование (домен, токены, пароли)
  2. Полное редактирование в nano/vim
- После изменений предлагает перезапустить сервисы

**Пример использования:**
```bash
$ ./manage.sh env:edit

==========================================
   Редактор .env конфигурации            
==========================================

Текущие значения:

Параметр                       | Значение
──────────────────────────────-+──────────────────────────────
NODE_ENV                       | production
PORT                           | 3000
DOMAIN                         | vpn.example.com
DB_HOST                        | postgres
TELEGRAM_BOT_TOKEN             | 1234567890:ABCdef...
YOOKASSA_SHOP_ID               | 12345
STRIPE_SECRET_KEY              | sk_test_...
GRAFANA_ADMIN_PASSWORD         | aB3dE5gH7jK9
ADMIN_EMAIL                    | admin@vpn.example.com

Хотите отредактировать .env? (y/N): y

Выберите способ редактирования:
  1) Быстрое редактирование (ключевые параметры)
  2) Полное редактирование (текстовый редактор)

Ваш выбор (1-2): 1
```

### Просмотр логов

```bash
# Все логи
./manage.sh logs

# Логи конкретного сервиса
./manage.sh logs api
./manage.sh logs bot
./manage.sh logs postgres
```

### Статус сервисов

```bash
./manage.sh status
```

Вывод включает:
- Статус контейнеров
- Использование CPU/RAM
- Сетевую активность

### Бэкап

```bash
./manage.sh backup
```

Бэкапы хранятся в `/opt/backups/smart-vpn/`

### Восстановление из бэкапа

```bash
# Показать доступные бэкапы
./manage.sh restore

# Восстановить из конкретного бэкапа
./manage.sh restore /opt/backups/smart-vpn/db_20240101_120000.sql
```

### Обновление проекта

```bash
./manage.sh update
```

Скрипт автоматически:
1. Создаёт бэкап
2. Pull'ит изменения из Git
3. Пересобирает образы
4. Применяет миграции

### Работа с БД

```bash
# Применить миграции
./manage.sh db:migrate

# Заполнить начальными данными
./manage.sh db:seed

# Создать администратора
./manage.sh admin:create
```

### Статистика

```bash
./manage.sh stats
```

Показывает:
- Количество пользователей
- Активные подписки
- Транзакции за сегодня
- общую выручку

---

## 🔧 Опции deploy.sh

### Развёртывание в production

```bash
./deploy.sh --production
```

### Развёртывание в staging

```bash
./deploy.sh --staging
```

### Обновление существующего развёртывания

```bash
./deploy.sh --update
```

### Создание бэкапа перед обновлением

```bash
./deploy.sh --update --backup
```

### Полная команда

```bash
./deploy.sh --production --backup
```

---

## 📁 Структура директорий

```
/opt/
├── smart-vpn/              # Проект
│   ├── src/
│   ├── config/
│   ├── docker-compose.yml
│   ├── .env               # Конфигурация (не коммитить!)
│   ├── deploy.sh
│   ├── manage.sh
│   └── setup-server.sh
│
├── backups/
│   └── smart-vpn/         # Бэкапы БД и конфигов
│       ├── db_20240101_120000.sql
│       └── configs_20240101_120000.tar.gz
│
└── logs/
    └── smart-vpn/         # Логи
```

---

## 🔐 Безопасность

### После развёртывания:

1. **Измените пароли по умолчанию:**
   - Grafana admin
   - API администратор

2. **Настройте доступ к админке:**
   ```bash
   # Ограничить доступ по IP
   sudo nano /etc/nginx/sites-available/smart-vpn
   ```

3. **Включите 2FA для SSH:**
   ```bash
   sudo apt install libpam-google-authenticator
   google-authenticator
   ```

4. **Настройте автоматические бэкапы:**
   ```bash
   # Добавить в crontab
   0 2 * * * /opt/smart-vpn/manage.sh backup
   ```

---

## 🐛 Troubleshooting

### Сервисы не запускаются

```bash
# Проверить логи
./manage.sh logs

# Проверить статус Docker
systemctl status docker

# Перезапустить Docker
systemctl restart docker
```

### Ошибки базы данных

```bash
# Пересоздать БД
./manage.sh stop
docker-compose run --rm postgres dropdb -U vpn_user vpn_db
docker-compose run --rm postgres createdb -U vpn_user vpn_db
./manage.sh start
./manage.sh db:migrate
```

### Проблемы с SSL

```bash
# Проверить сертификат
sudo certbot certificates

# Обновить
sudo certbot renew --dry-run

# Переполучить
sudo certbot delete --cert-name your-domain.com
sudo certbot --nginx -d your-domain.com
```

### Telegram бот не работает

```bash
# Проверить webhook
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"

# Установить заново
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-domain.com/telegram/webhook"
```

---

## 📊 Мониторинг

### Prometheus

```
http://your-server-ip:9090
```

Метрики:
- HTTP запросы
- Активные подключения
- Использование ресурсов

### Grafana

```
http://your-server-ip:3001
```

- Логин: `admin`
- Пароль: из вывода `deploy.sh`

### Логи

```bash
# Приложения
./manage.sh logs api

# Системные
journalctl -u docker
tail -f /var/log/nginx/error.log
```

---

## 📞 Поддержка

При возникновении проблем:

1. Проверьте логи: `./manage.sh logs`
2. Проверьте статус: `./manage.sh status`
3. Проверьте ресурсы: `docker stats`
4. Прочитайте документацию в `docs/`

---

## 📝 Примеры использования

### Ежедневное обслуживание

```bash
# Утром проверить статус
./manage.sh status

# Вечером создать бэкап
./manage.sh backup
```

### Обновление проекта

```bash
# С бэкапом
./manage.sh update

# Или вручную
git pull
./manage.sh backup
./manage.sh restart
./manage.sh db:migrate
```

### Добавление нового сервера

1. Развернуть на новом сервере
2. Добавить в БД через админку
3. Настроить балансировку

---

## 💻 Публикация на GitHub (Windows)

Для загрузки проекта на GitHub из-под Windows используйте один из скриптов:

### Вариант 1: Batch файл

```cmd
publish-to-github.bat
```

**Простой вариант** с базовыми функциями.

### Вариант 2: PowerShell скрипт

```powershell
.\publish-to-github.ps1
```

**Расширенный вариант** с дополнительными опциями:
- `-RepoUrl` — URL репозитория
- `-Branch` — ветка (по умолчанию "main")
- `-UseSSH` — использовать SSH вместо HTTPS
- `-SkipBackup` — не создавать бэкап

**Пример:**
```powershell
.\publish-to-github.ps1 -RepoUrl "https://github.com/username/smart-vpn.git" -UseSSH
```

### Что делают скрипты:

1. ✅ Проверяют установку Git
2. ✅ Инициализируют репозиторий (если нужно)
3. ✅ Создают .gitignore
4. ✅ Создают бэкап важных файлов
5. ✅ Настраивают удалённый репозиторий
6. ✅ Настраивают пользователя Git
7. ✅ Добавляют файлы и создают коммит
8. ✅ Публикуют на GitHub

### Полная документация

См. [docs/WINDOWS_GITHUB_SCRIPT.md](./WINDOWS_GITHUB_SCRIPT.md)

---

## ✅ Чеклист после развёртывания

- [ ] Проверить health endpoint: `curl https://your-domain.com/health`
- [ ] Проверить Telegram бота: `/start`
- [ ] Изменить пароли по умолчанию
- [ ] Настроить автоматические бэкапы
- [ ] Настроить мониторинг и алерты
- [ ] Протестировать подключение VPN
- [ ] Проверить платежные шлюзы (test mode)
- [ ] Опубликовать на GitHub (для доступа из любой точки)
