# Руководство по редактированию .env конфигурации

## 📝 Обзор

Файл `.env` содержит все критические параметры конфигурации Smart VPN. Этот документ описывает, как правильно редактировать конфигурацию.

---

## 🔧 Способы редактирования

### Способ 1: Через manage.sh (рекомендуется)

```bash
./manage.sh env:edit
```

**Преимущества:**
- ✅ Показывает текущие значения
- ✅ Автоматическая проверка ввода
- ✅ Предлагает перезапустить сервисы
- ✅ Безопасное редактирование

### Способ 2: Через deploy.sh (при первом запуске)

При первом развёртывании `./deploy.sh` автоматически предложит:
1. Сгенерировать начальный `.env`
2. Отредактировать ключевые параметры

### Способ 3: Прямое редактирование

```bash
# Установите редактор
apt-get install nano

# Откройте файл
nano .env

# После изменений сохраните (Ctrl+O, Enter) и выйдите (Ctrl+X)
```

**⚠️ Важно:** После изменений перезапустите сервисы:
```bash
./manage.sh restart
```

---

## 📋 Ключевые параметры

### Обязательные для production

| Параметр | Описание | Пример |
|----------|----------|--------|
| `NODE_ENV` | Режим работы | `production` |
| `XRAY_TLS_DOMAIN` | Домен VPN | `vpn.example.com` |
| `TELEGRAM_BOT_TOKEN` | Токен бота | `123456:ABCdef...` |
| `JWT_SECRET` | Секрет JWT | (случайная строка 64+ символов) |
| `DB_PASSWORD` | Пароль БД | (случайная строка 32+ символа) |

### Платежные шлюзы

| Параметр | Описание | Где получить |
|----------|----------|--------------|
| `YOOKASSA_SHOP_ID` | ID магазина ЮKassa | Личный кабинет ЮKassa |
| `YOOKASSA_SECRET_KEY` | Секретный ключ ЮKassa | Личный кабинет ЮKassa |
| `STRIPE_SECRET_KEY` | Секретный ключ Stripe | Stripe Dashboard |

### Администрирование

| Параметр | Описание | По умолчанию |
|----------|----------|--------------|
| `ADMIN_EMAIL` | Email администратора | `admin@localhost` |
| `ADMIN_PASSWORD` | Пароль администратора | (генерируется) |
| `GRAFANA_ADMIN_PASSWORD` | Пароль Grafana | (генерируется) |

---

## 🚀 Пошаговый процесс редактирования

### Шаг 1: Проверка текущего состояния

```bash
./manage.sh status
```

Убедитесь, что сервисы работают корректно перед изменениями.

### Шаг 2: Создание бэкапа

```bash
./manage.sh backup
```

Бэкап будет создан в `/opt/backups/smart-vpn/`

### Шаг 3: Редактирование

```bash
./manage.sh env:edit
```

Следуйте инструкциям:
1. Выберите способ редактирования (1 или 2)
2. Введите новые значения
3. Подтвердите перезапуск сервисов

### Шаг 4: Проверка

```bash
# Проверьте логи
./manage.sh logs api

# Проверьте статус
./manage.sh status
```

### Шаг 5: Тестирование

Проверьте основные функции:
```bash
# Health check
curl https://your-domain.com/health

# API test
curl https://your-domain.com/api/plans

# Telegram bot
# Отправьте /start в Telegram
```

---

## ⚠️ Критические изменения

### Изменение домена

Если меняете `XRAY_TLS_DOMAIN`:

```bash
./manage.sh env:edit
# Измените XRAY_TLS_DOMAIN

# Получите новый SSL сертификат
certbot --nginx -d new-domain.com

# Перезапустите
./manage.sh restart
```

### Изменение пароля БД

```bash
# 1. Остановите сервисы
./manage.sh stop

# 2. Измените пароль в .env
./manage.sh env:edit

# 3. Измените пароль в PostgreSQL
docker-compose run --rm postgres psql -U vpn_user -c \
  "ALTER USER vpn_user WITH PASSWORD 'new_password';"

# 4. Запустите сервисы
./manage.sh start
```

### Изменение JWT_SECRET

⚠️ **Внимание!** Это приведёт к недействительности всех текущих JWT токенов.

Пользователям придётся заново войти в систему.

```bash
./manage.sh env:edit
# Измените JWT_SECRET
./manage.sh restart
```

---

## 🔍 Проверка конфигурации

### Просмотр текущих значений

```bash
# Все параметры
cat .env | grep -v "^#" | grep -v "^$"

# Конкретный параметр
grep "^TELEGRAM_BOT_TOKEN=" .env
```

### Валидация

```bash
# Проверка критических параметров
./manage.sh env:edit
# Скрипт автоматически проверит JWT_SECRET и DB_PASSWORD
```

---

## 🛡️ Безопасность

### Рекомендации

1. **Не коммитьте .env в Git**
   ```bash
   # .env уже в .gitignore
   ```

2. **Используйте надёжные пароли**
   ```bash
   # Генерация безопасного пароля
   openssl rand -base64 32
   ```

3. **Ограничьте доступ к файлу**
   ```bash
   chmod 600 .env
   ```

4. **Регулярно меняйте пароли**
   ```bash
   # Каждые 90 дней
   ./manage.sh env:edit
   ```

5. **Храните бэкапы .env отдельно**
   ```bash
   cp .env /secure/location/.env.backup
   ```

---

## 📊 Таблица всех параметров

### Сервер

| Параметр | По умолчанию | Описание |
|----------|--------------|----------|
| `NODE_ENV` | `development` | Режим работы |
| `PORT` | `3000` | Порт API |
| `API_HOST` | `0.0.0.0` | Хост API |
| `APP_URL` | - | URL приложения |

### База данных

| Параметр | По умолчанию | Описание |
|----------|--------------|----------|
| `DB_HOST` | `postgres` | Хост PostgreSQL |
| `DB_PORT` | `5432` | Порт PostgreSQL |
| `DB_NAME` | `vpn_db` | Имя базы |
| `DB_USER` | `vpn_user` | Пользователь БД |
| `DB_PASSWORD` | - | Пароль БД |

### JWT

| Параметр | По умолчанию | Описание |
|----------|--------------|----------|
| `JWT_SECRET` | - | Секретный ключ |
| `JWT_EXPIRES_IN` | `7d` | Время жизни токена |

### Telegram

| Параметр | По умолчанию | Описание |
|----------|--------------|----------|
| `TELEGRAM_BOT_TOKEN` | - | Токен бота |
| `TELEGRAM_WEBHOOK_URL` | - | URL вебхука |

### Платежи

| Параметр | По умолчанию | Описание |
|----------|--------------|----------|
| `STRIPE_SECRET_KEY` | `sk_test_...` | Stripe ключ |
| `YOOKASSA_SHOP_ID` | `placeholder` | ЮKassa ID |
| `YOOKASSA_SECRET_KEY` | `placeholder` | ЮKassa ключ |

### Xray VPN

| Параметр | По умолчанию | Описание |
|----------|--------------|----------|
| `XRAY_SERVER_HOST` | `0.0.0.0` | Хост VPN |
| `XRAY_SERVER_PORT` | `443` | Порт VPN |
| `XRAY_TLS_DOMAIN` | - | Домен для TLS |
| `XRAY_UUID` | - | UUID сервера |

### Redis

| Параметр | По умолчанию | Описание |
|----------|--------------|----------|
| `REDIS_HOST` | `redis` | Хост Redis |
| `REDIS_PORT` | `6379` | Порт Redis |

### Мониторинг

| Параметр | По умолчанию | Описание |
|----------|--------------|----------|
| `PROMETHEUS_ENABLED` | `true` | Включить Prometheus |
| `GRAFANA_URL` | `http://localhost:3001` | URL Grafana |
| `GRAFANA_ADMIN_USER` | `admin` | Логин Grafana |
| `GRAFANA_ADMIN_PASSWORD` | - | Пароль Grafana |

### Админ

| Параметр | По умолчанию | Описание |
|----------|--------------|----------|
| `ADMIN_EMAIL` | `admin@localhost` | Email админа |
| `ADMIN_PASSWORD` | - | Пароль админа |
| `ADMIN_TELEGRAM_IDS` | - | Telegram ID админов |

### Бэкап

| Параметр | По умолчанию | Описание |
|----------|--------------|----------|
| `BACKUP_TELEGRAM_CHAT_ID` | - | Chat ID для бэкапов |
| `BACKUP_INTERVAL` | `86400` | Интервал бэкапов (сек) |

---

## 🐛 Troubleshooting

### Ошибка: ".env файл не найден"

```bash
# Сгенерируйте новый
cp .env.example .env
./manage.sh env:edit
```

### Ошибка: "Неверный формат параметра"

Проверьте, что:
- Нет лишних пробелов
- Нет кавычек вокруг значений
- Нет специальных символов без экранирования

**Правильно:**
```ini
DB_PASSWORD=mySecurePassword123
```

**Неправильно:**
```ini
DB_PASSWORD="mySecurePassword123"  # Кавычки
DB_PASSWORD= mySecurePassword123   # Пробел
```

### Сервисы не перезапускаются после изменений

```bash
# Принудительный рестарт
./manage.sh stop
docker-compose down
./manage.sh start
```

### Потеряли .env файл

```bash
# Восстановите из бэкапа
cp /opt/backups/smart-vpn/configs_*.tar.gz .
tar -xzf configs_*.tar.gz .env

# Или сгенерируйте новый
./manage.sh env:edit
```

---

## 📞 Поддержка

При проблемах с конфигурацией:

1. Проверьте логи: `./manage.sh logs`
2. Проверьте синтаксис: `cat .env`
3. Восстановите из бэкапа: `./manage.sh restore`
4. Обратитесь в поддержку
