#!/bin/bash

################################################################################
# Smart VPN — Автоматический скрипт развёртывания
# 
# Использование:
#   ./deploy.sh [OPTIONS]
#
# Опции:
#   --production    Развёртывание в production режиме
#   --staging       Развёртывание в staging режиме
#   --update        Обновление существующего развёртывания
#   --backup        Создать бэкап перед обновлением
#   --help          Показать эту справку
#
# Примеры:
#   ./deploy.sh --production
#   ./deploy.sh --staging --backup
#   ./deploy.sh --update
################################################################################

set -e

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Переменные
ENVIRONMENT="development"
DO_BACKUP=false
DO_UPDATE=false
PROJECT_DIR="/opt/smart-vpn"
BACKUP_DIR="/opt/backups/smart-vpn"
LOG_FILE="/var/log/smart-vpn-deploy.log"

# Логирование
log() {
    local level=$1
    shift
    local message="$@"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo -e "${timestamp} [${level}] ${message}" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${BLUE}[INFO]${NC} $@"
    log "INFO" "$@"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $@"
    log "SUCCESS" "$@"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $@"
    log "WARN" "$@"
}

error() {
    echo -e "${RED}[ERROR]${NC} $@"
    log "ERROR" "$@"
    exit 1
}

# Показать справку
show_help() {
    head -20 "$0" | tail -17
    exit 0
}

# Парсинг аргументов
while [[ $# -gt 0 ]]; do
    case $1 in
        --production)
            ENVIRONMENT="production"
            shift
            ;;
        --staging)
            ENVIRONMENT="staging"
            shift
            ;;
        --update)
            DO_UPDATE=true
            shift
            ;;
        --backup)
            DO_BACKUP=true
            shift
            ;;
        --help)
            show_help
            ;;
        *)
            error "Неизвестная опция: $1"
            ;;
    esac
done

################################################################################
# Проверка требований
################################################################################
check_requirements() {
    info "Проверка системных требований..."
    
    # Проверка root прав
    if [[ $EUID -ne 0 ]]; then
        error "Этот скрипт должен выполняться от root"
    fi
    
    # Проверка Docker
    if ! command -v docker &> /dev/null; then
        warn "Docker не установлен. Установка..."
        install_docker
    fi
    
    # Проверка Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        warn "Docker Compose не установлен. Установка..."
        apt-get update && apt-get install -y docker-compose
    fi
    
    # Проверка Git
    if ! command -v git &> /dev/null; then
        warn "Git не установлен. Установка..."
        apt-get update && apt-get install -y git
    fi
    
    # Проверка Nginx
    if ! command -v nginx &> /dev/null; then
        warn "Nginx не установлен. Установка..."
        apt-get update && apt-get install -y nginx
    fi
    
    success "Все требования выполнены"
}

################################################################################
# Установка Docker
################################################################################
install_docker() {
    info "Установка Docker..."
    
    apt-get update
    apt-get install -y \
        apt-transport-https \
        ca-certificates \
        curl \
        gnupg \
        lsb-release
    
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    
    echo \
      "deb [arch=amd64 signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io
    
    # Добавить текущего пользователя в группу docker
    usermod -aG docker $SUDO_USER || true
    
    success "Docker установлен"
}

################################################################################
# Подготовка сервера
################################################################################
prepare_server() {
    info "Подготовка сервера..."
    
    # Обновление системы
    apt-get update && apt-get upgrade -y
    
    # Установка зависимостей
    apt-get install -y \
        curl \
        git \
        nginx \
        certbot \
        python3-certbot-nginx \
        ufw \
        fail2ban \
        jq
    
    # Настройка firewall
    setup_firewall
    
    success "Сервер подготовлен"
}

################################################################################
# Настройка Firewall
################################################################################
setup_firewall() {
    info "Настройка firewall..."
    
    # Разрешить SSH
    ufw allow 22/tcp
    
    # Разрешить HTTP/HTTPS
    ufw allow 80/tcp
    ufw allow 443/tcp
    
    # Разрешить VPN порт
    ufw allow 443/udp
    
    # Включить firewall (если не включен)
    if ! ufw status | grep -q "Status: active"; then
        echo "y" | ufw enable
    fi
    
    success "Firewall настроен"
}

################################################################################
# Клонирование проекта
################################################################################
clone_project() {
    info "Клонирование проекта..."
    
    # Создать директорию
    mkdir -p "$PROJECT_DIR"
    cd "$PROJECT_DIR"
    
    # Если это обновление, pull иначе clone
    if [[ "$DO_UPDATE" == true ]] && [[ -d ".git" ]]; then
        git pull origin main
        success "Проект обновлён"
    else
        # Запросить URL репозитория
        read -p "Введите URL Git репозитория: " REPO_URL
        if [[ -z "$REPO_URL" ]]; then
            REPO_URL="https://github.com/yourusername/smart-vpn.git"
            warn "Используется URL по умолчанию: $REPO_URL"
        fi
        
        if [[ -d ".git" ]]; then
            git pull
        else
            git clone "$REPO_URL" .
        fi
        
        success "Проект склонирован"
    fi
    
    # Установить права
    chown -R $SUDO_USER:$SUDO_USER "$PROJECT_DIR" 2>/dev/null || true
}

################################################################################
# Генерация .env файла
################################################################################
generate_env() {
    info "Генерация .env файла..."
    
    cd "$PROJECT_DIR"
    
    # Скопировать шаблон
    cp -n .env.example .env 2>/dev/null || cp .env.example .env
    
    # Генерация случайных значений
    JWT_SECRET=$(openssl rand -hex 32)
    DB_PASSWORD=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)
    GRAFANA_PASSWORD=$(openssl rand -base64 12 | tr -d '/+=' | head -c 16)
    ADMIN_PASSWORD=$(openssl rand -base64 12 | tr -d '/+=' | head -c 12)
    XRAY_UUID=$(cat /proc/sys/kernel/random/uuid)
    
    # Запрос домена
    read -p "Введите домен (например, vpn.example.com): " DOMAIN
    if [[ -z "$DOMAIN" ]]; then
        DOMAIN="localhost"
        warn "Используется localhost"
    fi
    
    # Запрос Telegram токена
    read -p "Введите Telegram Bot Token: " TG_TOKEN
    if [[ -z "$TG_TOKEN" ]]; then
        warn "Telegram бот не будет настроен"
        TG_TOKEN="placeholder"
    fi
    
    # Запрос платежных шлюзов
    echo ""
    info "Настройка платежных шлюзов:"
    read -p "YooKassa Shop ID (оставьте пустым для пропуска): " YK_SHOP_ID
    read -p "YooKassa Secret Key (оставьте пустым для пропуска): " YK_SECRET_KEY
    read -p "Stripe Secret Key (оставьте пустым для пропуска): " STRIPE_KEY
    
    # Обновление .env файла
    cat > .env << EOF
# ===========================================
# Smart VPN Configuration
# Generated: $(date)
# ===========================================

# Server Configuration
NODE_ENV=$ENVIRONMENT
PORT=3000
API_HOST=0.0.0.0
APP_URL=https://$DOMAIN

# ===========================================
# Database Configuration
# ===========================================
DB_HOST=postgres
DB_PORT=5432
DB_NAME=vpn_db
DB_USER=vpn_user
DB_PASSWORD=$DB_PASSWORD

# ===========================================
# JWT Configuration
# ===========================================
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=7d

# ===========================================
# Telegram Bot
# ===========================================
TELEGRAM_BOT_TOKEN=$TG_TOKEN
TELEGRAM_WEBHOOK_URL=https://$DOMAIN/telegram/webhook

# ===========================================
# Payment Gateways
# ===========================================
STRIPE_SECRET_KEY=${STRIPE_KEY:-sk_test_placeholder}
YOOKASSA_SHOP_ID=${YK_SHOP_ID:-placeholder}
YOOKASSA_SECRET_KEY=${YK_SECRET_KEY:-placeholder}

# ===========================================
# Xray VPN Configuration
# ===========================================
XRAY_SERVER_HOST=0.0.0.0
XRAY_SERVER_PORT=443
XRAY_TLS_DOMAIN=$DOMAIN
XRAY_UUID=$XRAY_UUID

# Cloudflare WARP
WARP_ENABLED=false
WARP_LICENSE_KEY=

# ===========================================
# Redis Configuration
# ===========================================
REDIS_HOST=redis
REDIS_PORT=6379

# ===========================================
# Monitoring
# ===========================================
PROMETHEUS_ENABLED=true
GRAFANA_URL=http://localhost:3001
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=$GRAFANA_PASSWORD

# ===========================================
# Admin Configuration
# ===========================================
ADMIN_EMAIL=admin@$DOMAIN
ADMIN_PASSWORD=$ADMIN_PASSWORD
ADMIN_TELEGRAM_IDS=

# ===========================================
# Backup
# ===========================================
BACKUP_TELEGRAM_CHAT_ID=
BACKUP_INTERVAL=86400
EOF

    chmod 600 .env
    
    success ".env файл сгенерирован"
    
    # Показать важные данные
    echo ""
    warn "⚠️  Сохраните эти данные в безопасном месте:"
    echo "  ─────────────────────────────────────"
    echo "  Domain: $DOMAIN"
    echo "  Grafana URL: http://$DOMAIN:3001"
    echo "  Grafana Login: admin"
    echo "  Grafana Password: $GRAFANA_PASSWORD"
    echo "  Admin Email: admin@$DOMAIN"
    echo "  Admin Password: $ADMIN_PASSWORD"
    echo "  ─────────────────────────────────────"
    echo ""
}

################################################################################
# Редактирование .env файла
################################################################################
edit_env() {
    cd "$PROJECT_DIR"
    
    if [[ ! -f .env ]]; then
        warn ".env файл не найден. Сначала сгенерируйте его."
        return 1
    fi
    
    echo ""
    echo "=========================================="
    echo "   Редактор конфигурации .env            "
    echo "=========================================="
    echo ""
    
    # Показать текущие значения
    info "Текущие значения:"
    echo ""
    printf "%-30s | %s\n" "Параметр" "Значение"
    printf "%-30s-+-%s\n" "──────────────────────────────" "──────────────────────────────"
    printf "%-30s | %s\n" "NODE_ENV" "$(grep '^NODE_ENV=' .env | cut -d'=' -f2)"
    printf "%-30s | %s\n" "DOMAIN" "$(grep '^XRAY_TLS_DOMAIN=' .env | cut -d'=' -f2)"
    printf "%-30s | %s\n" "PORT" "$(grep '^PORT=' .env | cut -d'=' -f2)"
    printf "%-30s | %s\n" "DB_HOST" "$(grep '^DB_HOST=' .env | cut -d'=' -f2)"
    printf "%-30s | %s\n" "TELEGRAM_BOT_TOKEN" "$(grep '^TELEGRAM_BOT_TOKEN=' .env | cut -d'=' -f2 | head -c 20)..."
    printf "%-30s | %s\n" "YOOKASSA_SHOP_ID" "$(grep '^YOOKASSA_SHOP_ID=' .env | cut -d'=' -f2)"
    printf "%-30s | %s\n" "STRIPE_SECRET_KEY" "$(grep '^STRIPE_SECRET_KEY=' .env | cut -d'=' -f2 | head -c 20)..."
    printf "%-30s | %s\n" "GRAFANA_ADMIN_PASSWORD" "$(grep '^GRAFANA_ADMIN_PASSWORD=' .env | cut -d'=' -f2)"
    printf "%-30s | %s\n" "ADMIN_EMAIL" "$(grep '^ADMIN_EMAIL=' .env | cut -d'=' -f2)"
    echo ""
    
    # Предложить редактирование
    read -p "Хотите отредактировать .env файл? (y/N): " confirm_edit
    
    if [[ "$confirm_edit" == "y" ]] || [[ "$confirm_edit" == "Y" ]]; then
        # Выбрать способ редактирования
        echo ""
        info "Выберите способ редактирования:"
        echo "  1) Быстрое редактирование ключевых параметров"
        echo "  2) Полное редактирование в текстовом редакторе"
        echo "  3) Пропустить"
        echo ""
        read -p "Ваш выбор (1-3): " edit_mode
        
        case $edit_mode in
            1)
                info "Быстрое редактирование..."
                echo ""
                
                # NODE_ENV
                current=$(grep '^NODE_ENV=' .env | cut -d'=' -f2)
                read -p "NODE_ENV [$current]: " new_val
                if [[ -n "$new_val" ]]; then
                    sed -i "s/^NODE_ENV=.*/NODE_ENV=$new_val/" .env
                fi
                
                # DOMAIN
                current=$(grep '^XRAY_TLS_DOMAIN=' .env | cut -d'=' -f2)
                read -p "XRAY_TLS_DOMAIN [$current]: " new_val
                if [[ -n "$new_val" ]]; then
                    sed -i "s|^XRAY_TLS_DOMAIN=.*|XRAY_TLS_DOMAIN=$new_val|" .env
                    sed -i "s|^TELEGRAM_WEBHOOK_URL=.*|TELEGRAM_WEBHOOK_URL=https://$new_val/telegram/webhook|" .env
                    sed -i "s|^APP_URL=.*|APP_URL=https://$new_val|" .env
                    sed -i "s|^ADMIN_EMAIL=.*|ADMIN_EMAIL=admin@$new_val|" .env
                fi
                
                # PORT
                current=$(grep '^PORT=' .env | cut -d'=' -f2)
                read -p "PORT [$current]: " new_val
                if [[ -n "$new_val" ]]; then
                    sed -i "s/^PORT=.*/PORT=$new_val/" .env
                fi
                
                # DB_HOST
                current=$(grep '^DB_HOST=' .env | cut -d'=' -f2)
                read -p "DB_HOST [$current]: " new_val
                if [[ -n "$new_val" ]]; then
                    sed -i "s/^DB_HOST=.*/DB_HOST=$new_val/" .env
                fi
                
                # TELEGRAM_BOT_TOKEN
                current=$(grep '^TELEGRAM_BOT_TOKEN=' .env | cut -d'=' -f2)
                read -p "TELEGRAM_BOT_TOKEN [текущее значение]: " new_val
                if [[ -n "$new_val" ]]; then
                    sed -i "s/^TELEGRAM_BOT_TOKEN=.*/TELEGRAM_BOT_TOKEN=$new_val/" .env
                fi
                
                # YOOKASSA_SHOP_ID
                current=$(grep '^YOOKASSA_SHOP_ID=' .env | cut -d'=' -f2)
                read -p "YOOKASSA_SHOP_ID [текущее значение]: " new_val
                if [[ -n "$new_val" ]]; then
                    sed -i "s/^YOOKASSA_SHOP_ID=.*/YOOKASSA_SHOP_ID=$new_val/" .env
                fi
                
                # YOOKASSA_SECRET_KEY
                current=$(grep '^YOOKASSA_SECRET_KEY=' .env | cut -d'=' -f2)
                read -p "YOOKASSA_SECRET_KEY [текущее значение]: " new_val
                if [[ -n "$new_val" ]]; then
                    sed -i "s/^YOOKASSA_SECRET_KEY=.*/YOOKASSA_SECRET_KEY=$new_val/" .env
                fi
                
                # STRIPE_SECRET_KEY
                current=$(grep '^STRIPE_SECRET_KEY=' .env | cut -d'=' -f2)
                read -p "STRIPE_SECRET_KEY [текущее значение]: " new_val
                if [[ -n "$new_val" ]]; then
                    sed -i "s/^STRIPE_SECRET_KEY=.*/STRIPE_SECRET_KEY=$new_val/" .env
                fi
                
                # ADMIN_EMAIL
                current=$(grep '^ADMIN_EMAIL=' .env | cut -d'=' -f2)
                read -p "ADMIN_EMAIL [$current]: " new_val
                if [[ -n "$new_val" ]]; then
                    sed -i "s/^ADMIN_EMAIL=.*/ADMIN_EMAIL=$new_val/" .env
                fi
                
                # ADMIN_PASSWORD
                current=$(grep '^ADMIN_PASSWORD=' .env | cut -d'=' -f2)
                read -p "ADMIN_PASSWORD [оставьте пустым для сохранения текущего]: " new_val
                if [[ -n "$new_val" ]]; then
                    sed -i "s/^ADMIN_PASSWORD=.*/ADMIN_PASSWORD=$new_val/" .env
                fi
                
                # GRAFANA_ADMIN_PASSWORD
                current=$(grep '^GRAFANA_ADMIN_PASSWORD=' .env | cut -d'=' -f2)
                read -p "GRAFANA_ADMIN_PASSWORD [оставьте пустым для сохранения текущего]: " new_val
                if [[ -n "$new_val" ]]; then
                    sed -i "s/^GRAFANA_ADMIN_PASSWORD=.*/GRAFANA_ADMIN_PASSWORD=$new_val/" .env
                fi
                
                success "Конфигурация обновлена"
                ;;
                
            2)
                info "Открытие .env файла в редакторе..."
                
                # Выбрать доступный редактор
                if command -v nano &> /dev/null; then
                    nano .env
                elif command -v vim &> /dev/null; then
                    vim .env
                elif command -v vi &> /dev/null; then
                    vi .env
                else
                    # Если нет редакторов, использовать cat с перенаправлением
                    warn "Редактор не найден. Используйте cat для просмотра:"
                    cat .env
                    echo ""
                    info "Для редактирования установите nano или vim:"
                    echo "  apt-get install nano"
                    echo ""
                    read -p "Нажмите Enter для продолжения..."
                fi
                
                success "Редактирование завершено"
                ;;
                
            3)
                info "Пропуск редактирования"
                ;;
                
            *)
                warn "Неверный выбор, пропускаем..."
                ;;
        esac
    else
        info "Пропуск редактирования"
    fi
    
    # Проверка критических параметров
    echo ""
    info "Проверка конфигурации..."
    
    # Проверка JWT_SECRET
    jwt_secret=$(grep '^JWT_SECRET=' .env | cut -d'=' -f2)
    if [[ "$jwt_secret" == "your_jwt_secret_key_here" ]] || [[ -z "$jwt_secret" ]]; then
        warn "JWT_SECRET не настроен! Генерируем новый..."
        new_secret=$(openssl rand -hex 32)
        sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$new_secret/" .env
        success "JWT_SECRET сгенерирован"
    fi
    
    # Проверка DB_PASSWORD
    db_password=$(grep '^DB_PASSWORD=' .env | cut -d'=' -f2)
    if [[ "$db_password" == "your_password_here" ]] || [[ -z "$db_password" ]]; then
        warn "DB_PASSWORD не настроен! Генерируем новый..."
        new_password=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)
        sed -i "s/^DB_PASSWORD=.*/DB_PASSWORD=$new_password/" .env
        success "DB_PASSWORD сгенерирован"
    fi
    
    # Проверка TELEGRAM_BOT_TOKEN
    tg_token=$(grep '^TELEGRAM_BOT_TOKEN=' .env | cut -d'=' -f2)
    if [[ "$tg_token" == "your_bot_token_here" ]] || [[ "$tg_token" == "placeholder" ]]; then
        warn "TELEGRAM_BOT_TOKEN не настроен или установлен в placeholder"
        echo "  Telegram бот не будет работать без valid токена"
        echo "  Получите токен в @BotFather"
    fi
    
    success "Проверка завершена"
}

################################################################################
# Получение SSL сертификатов
################################################################################
setup_ssl() {
    info "Настройка SSL сертификатов..."
    
    cd "$PROJECT_DIR"
    
    # Извлечь домен из .env
    DOMAIN=$(grep XRAY_TLS_DOMAIN .env | cut -d'=' -f2)
    
    if [[ "$DOMAIN" == "localhost" ]]; then
        warn "Пропуск SSL для localhost"
        # Создать самоподписанные сертификаты для разработки
        mkdir -p config/certs
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout config/certs/privkey.pem \
            -out config/certs/fullchain.pem \
            -subj "/CN=localhost"
        cp config/certs/privkey.pem config/certs/chain.pem
        success "Самоподписанные сертификаты созданы"
        return
    fi
    
    # Остановить nginx для получения сертификата
    systemctl stop nginx 2>/dev/null || true
    
    # Получить сертификат Let's Encrypt
    certbot certonly --standalone -d "$DOMAIN" --non-interactive --agree-tos \
        --email admin@"$DOMAIN" || {
        warn "Не удалось получить SSL сертификат. Продолжаем без SSL..."
        return
    }
    
    # Копировать сертификаты
    mkdir -p config/certs
    cp /etc/letsencrypt/live/$DOMAIN/fullchain.pem config/certs/
    cp /etc/letsencrypt/live/$DOMAIN/privkey.pem config/certs/
    cp /etc/letsencrypt/live/$DOMAIN/chain.pem config/certs/
    
    success "SSL сертификаты настроены"
}

################################################################################
# Настройка Nginx
################################################################################
setup_nginx() {
    info "Настройка Nginx..."
    
    cd "$PROJECT_DIR"
    
    DOMAIN=$(grep XRAY_TLS_DOMAIN .env | cut -d'=' -f2)
    
    # Создать конфиг nginx
    cat > /etc/nginx/sites-available/smart-vpn << EOF
server {
    listen 80;
    server_name $DOMAIN;
    
    # ACME challenge для Let's Encrypt
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    # Redirect HTTP to HTTPS (except for localhost)
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security Headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # API Proxy
    location /api/ {
        proxy_pass http://localhost:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }

    # Telegram Webhook
    location /telegram/webhook {
        proxy_pass http://localhost:3000/telegram/webhook;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Health Check
    location /health {
        proxy_pass http://localhost:3000/health;
        access_log off;
    }

    # Metrics (restricted)
    location /metrics {
        proxy_pass http://localhost:3000/metrics;
        allow 10.0.0.0/8;
        allow 172.16.0.0/12;
        allow 192.168.0.0/16;
        deny all;
    }
}
EOF

    # Активация конфигурации
    ln -sf /etc/nginx/sites-available/smart-vpn /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default
    
    # Проверка и перезапуск nginx
    nginx -t && systemctl restart nginx
    
    success "Nginx настроен"
}

################################################################################
# Создание бэкапа
################################################################################
create_backup() {
    if [[ "$DO_BACKUP" != true ]]; then
        return
    fi
    
    info "Создание бэкапа..."
    
    mkdir -p "$BACKUP_DIR"
    
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    
    # Бэкап базы данных
    if docker-compose ps | grep -q postgres; then
        docker-compose exec -T postgres pg_dump -U vpn_user vpn_db > "$BACKUP_DIR/db_$TIMESTAMP.sql"
        success "Бэкап БД создан: $BACKUP_DIR/db_$TIMESTAMP.sql"
    fi
    
    # Бэкап конфигов
    tar -czf "$BACKUP_DIR/configs_$TIMESTAMP.tar.gz" \
        -C "$PROJECT_DIR" config .env 2>/dev/null || true
    
    success "Бэкап конфигурации создан"
    
    # Удаление старых бэкапов (старше 7 дней)
    find "$BACKUP_DIR" -name "*.sql" -mtime +7 -delete
    find "$BACKUP_DIR" -name "*.tar.gz" -mtime +7 -delete
    
    success "Старые бэкапы удалены"
}

################################################################################
# Запуск сервисов
################################################################################
start_services() {
    info "Запуск сервисов..."
    
    cd "$PROJECT_DIR"
    
    # Сборка образов
    docker-compose build
    
    # Запуск
    docker-compose up -d
    
    # Ожидание готовности
    info "Ожидание готовности сервисов..."
    sleep 10
    
    # Проверка статуса
    docker-compose ps
    
    success "Сервисы запущены"
}

################################################################################
# Инициализация базы данных
################################################################################
init_database() {
    info "Инициализация базы данных..."
    
    cd "$PROJECT_DIR"
    
    # Ожидание готовности PostgreSQL
    for i in {1..30}; do
        if docker-compose exec -T postgres pg_isready -U vpn_user &>/dev/null; then
            success "PostgreSQL готов"
            break
        fi
        if [[ $i -eq 30 ]]; then
            error "PostgreSQL не запустился"
        fi
        info "Ожидание PostgreSQL... ($i/30)"
        sleep 2
    done
    
    # Применение миграций
    docker-compose exec -T api npm run db:migrate || {
        warn "Миграции не применены (возможно уже применены)"
    }
    
    # Заполнение начальными данными
    docker-compose exec -T api npm run db:seed || {
        warn "Seed не выполнен"
    }
    
    # Создание администратора
    docker-compose exec -T api node src/scripts/create-admin.js || {
        warn "Администратор не создан"
    }
    
    success "База данных инициализирована"
}

################################################################################
# Настройка Telegram вебхука
################################################################################
setup_telegram_webhook() {
    info "Настройка Telegram вебхука..."
    
    cd "$PROJECT_DIR"
    
    TG_TOKEN=$(grep TELEGRAM_BOT_TOKEN .env | cut -d'=' -f2)
    DOMAIN=$(grep XRAY_TLS_DOMAIN .env | cut -d'=' -f2)
    
    if [[ "$TG_TOKEN" == "placeholder" ]] || [[ -z "$TG_TOKEN" ]]; then
        warn "Telegram токен не настроен, пропускаем..."
        return
    fi
    
    WEBHOOK_URL="https://$DOMAIN/telegram/webhook"
    
    # Установка webhook
    response=$(curl -s -X POST "https://api.telegram.org/bot$TG_TOKEN/setWebhook?url=$WEBHOOK_URL")
    
    if echo "$response" | jq -e '.ok' > /dev/null; then
        success "Telegram вебхук установлен: $WEBHOOK_URL"
    else
        warn "Не удалось установить Telegram вебхук: $response"
    fi
}

################################################################################
# Финальная проверка
################################################################################
final_check() {
    info "Финальная проверка..."
    
    cd "$PROJECT_DIR"
    
    # Проверка API
    if curl -sf http://localhost:3000/health > /dev/null; then
        success "API сервер работает"
    else
        warn "API сервер не отвечает"
    fi
    
    # Проверка сервисов
    docker-compose ps
    
    # Показать логи
    echo ""
    info "Последние логи:"
    docker-compose logs --tail=20
    
    success "Развёртывание завершено!"
}

################################################################################
# Показать итоговую информацию
################################################################################
show_summary() {
    cd "$PROJECT_DIR"
    
    DOMAIN=$(grep XRAY_TLS_DOMAIN .env | cut -d'=' -f2)
    GRAFANA_PASS=$(grep GRAFANA_ADMIN_PASSWORD .env | cut -d'=' -f2)
    ADMIN_PASS=$(grep ADMIN_PASSWORD .env | cut -d'=' -f2)
    
    echo ""
    echo "=========================================="
    echo "     Smart VPN развёрнут успешно!        "
    echo "=========================================="
    echo ""
    echo "📊 Сервисы:"
    echo "   API:         https://$DOMAIN/api/"
    echo "   Health:      https://$DOMAIN/health"
    echo "   Metrics:     https://$DOMAIN/metrics"
    echo "   Grafana:     http://localhost:3001"
    echo "   Prometheus:  http://localhost:9090"
    echo ""
    echo "🔐 Учётные данные:"
    echo "   Grafana:"
    echo "     Логин: admin"
    echo "     Пароль: $GRAFANA_PASS"
    echo ""
    echo "   Admin:"
    echo "     Email: admin@$DOMAIN"
    echo "     Пароль: $ADMIN_PASS"
    echo ""
    echo "🤖 Telegram Bot:"
    echo "   Webhook: https://$DOMAIN/telegram/webhook"
    echo ""
    echo "📁 Директория проекта: $PROJECT_DIR"
    echo "📁 Директория бэкапов: $BACKUP_DIR"
    echo ""
    echo "=========================================="
    echo ""
    warn "⚠️  Измените пароли по умолчанию!"
    echo ""
}

################################################################################
# Основная функция
################################################################################
main() {
    echo ""
    echo "=========================================="
    echo "   Smart VPN Deployment Script           "
    echo "   Environment: $ENVIRONMENT              "
    echo "=========================================="
    echo ""
    
    # Создать директорию для логов
    mkdir -p $(dirname "$LOG_FILE")
    touch "$LOG_FILE"
    
    check_requirements
    
    if [[ "$DO_UPDATE" == true ]]; then
        create_backup
        clone_project
        edit_env
        start_services
        init_database
        final_check
    else
        prepare_server
        clone_project
        generate_env
        edit_env
        setup_ssl
        setup_nginx
        create_backup
        start_services
        init_database
        setup_telegram_webhook
        final_check
    fi
    
    show_summary
    
    exit 0
}

# Запуск
main
