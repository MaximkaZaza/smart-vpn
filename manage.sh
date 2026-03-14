#!/bin/bash

################################################################################
# Smart VPN — Скрипт управления сервисами
# 
# Использование:
#   ./manage.sh [COMMAND] [OPTIONS]
#
# Команды:
#   start           Запустить все сервисы
#   stop            Остановить все сервисы
#   restart         Перезапустить все сервисы
#   status          Показать статус сервисов
#   logs            Показать логи
#   backup          Создать бэкап
#   restore         Восстановить из бэкапа
#   update          Обновить проект
#   db:migrate      Применить миграции
#   db:seed         Заполнить БД данными
#   admin:create    Создать администратора
#   stats           Показать статистику
#   env:edit        Редактировать .env конфигурацию
#   help            Показать справку
################################################################################

set -e

# Цвета
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Переменные
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="/opt/backups/smart-vpn"
cd "$PROJECT_DIR"

info() {
    echo -e "${BLUE}[INFO]${NC} $@"
}

success() {
    echo -e "${GREEN}[OK]${NC} $@"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $@"
}

error() {
    echo -e "${RED}[ERROR]${NC} $@"
    exit 1
}

# Команды
cmd_start() {
    info "Запуск сервисов..."
    docker-compose up -d
    success "Сервисы запущены"
}

cmd_stop() {
    info "Остановка сервисов..."
    docker-compose down
    success "Сервисы остановлены"
}

cmd_restart() {
    cmd_stop
    sleep 2
    cmd_start
}

cmd_status() {
    info "Статус сервисов:"
    echo ""
    docker-compose ps
    echo ""
    
    info "Использование ресурсов:"
    docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
}

cmd_logs() {
    local service=$1
    local lines=${2:-50}
    
    if [[ -n "$service" ]]; then
        docker-compose logs --tail=$lines "$service"
    else
        docker-compose logs --tail=$lines
    fi
}

cmd_backup() {
    info "Создание бэкапа..."
    
    mkdir -p "$BACKUP_DIR"
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    
    # Бэкап БД
    if docker-compose ps | grep -q postgres; then
        info "Бэкап базы данных..."
        docker-compose exec -T postgres pg_dump -U vpn_user vpn_db > "$BACKUP_DIR/db_$TIMESTAMP.sql"
        success "Бэкап БД: $BACKUP_DIR/db_$TIMESTAMP.sql"
    fi
    
    # Бэкап конфигов
    info "Бэкап конфигурации..."
    tar -czf "$BACKUP_DIR/configs_$TIMESTAMP.tar.gz" \
        -C "$PROJECT_DIR" config .env 2>/dev/null || true
    success "Бэкап конфигурации: $BACKUP_DIR/configs_$TIMESTAMP.tar.gz"
    
    # Очистка старых бэкапов
    find "$BACKUP_DIR" -name "*.sql" -mtime +7 -delete
    find "$BACKUP_DIR" -name "*.tar.gz" -mtime +7 -delete
    success "Старые бэкапы удалены"
}

cmd_restore() {
    local backup_file=$1
    
    if [[ -z "$backup_file" ]]; then
        # Показать список доступных бэкапов
        info "Доступные бэкапы:"
        ls -lh "$BACKUP_DIR"/*.sql 2>/dev/null || {
            error "Бэкапы не найдены в $BACKUP_DIR"
        }
        echo ""
        echo "Использование: $0 restore <backup_file>"
        echo "Пример: $0 restore /opt/backups/smart-vpn/db_20240101_120000.sql"
        return
    fi
    
    if [[ ! -f "$backup_file" ]]; then
        error "Файл бэкапа не найден: $backup_file"
    fi
    
    warn "Восстановление удалит текущие данные!"
    read -p "Продолжить? (y/N): " confirm
    
    if [[ "$confirm" != "y" ]] && [[ "$confirm" != "Y" ]]; then
        info "Отменено"
        return
    fi
    
    info "Восстановление из $backup_file..."
    
    # Остановить сервисы
    docker-compose down
    
    # Очистить БД
    docker-compose run --rm postgres dropdb -U vpn_user vpn_db 2>/dev/null || true
    docker-compose run --rm postgres createdb -U vpn_user vpn_db
    
    # Восстановить из бэкапа
    cat "$backup_file" | docker-compose exec -T postgres psql -U vpn_user vpn_db
    
    # Запустить сервисы
    docker-compose up -d
    
    success "Восстановление завершено"
}

cmd_update() {
    info "Обновление проекта..."
    
    # Бэкап
    cmd_backup
    
    # Pull изменений
    git pull origin main || {
        warn "Git pull не удался"
    }
    
    # Пересборка
    docker-compose build
    
    # Перезапуск
    docker-compose up -d
    
    # Миграции
    cmd_db_migrate
    
    success "Обновление завершено"
}

cmd_db_migrate() {
    info "Применение миграций..."
    docker-compose exec -T api npm run db:migrate
    success "Миграции применены"
}

cmd_db_seed() {
    info "Заполнение БД..."
    docker-compose exec -T api npm run db:seed
    success "БД заполнена"
}

cmd_admin_create() {
    info "Создание администратора..."
    docker-compose exec -T api node src/scripts/create-admin.js
}

cmd_stats() {
    info "Статистика:"
    echo ""
    
    # Пользователи
    local users=$(docker-compose exec -T postgres psql -U vpn_user vpn_db -t -c "SELECT COUNT(*) FROM users;" 2>/dev/null | tr -d ' ')
    echo "Пользователей: ${users:-0}"
    
    # Активные подписки
    local subs=$(docker-compose exec -T postgres psql -U vpn_user vpn_db -t -c "SELECT COUNT(*) FROM subscriptions WHERE is_active=true AND end_date > NOW();" 2>/dev/null | tr -d ' ')
    echo "Активных подписок: ${subs:-0}"
    
    # Транзакции за сегодня
    local transactions=$(docker-compose exec -T postgres psql -U vpn_user vpn_db -t -c "SELECT COUNT(*) FROM transactions WHERE DATE(created_at) = CURRENT_DATE;" 2>/dev/null | tr -d ' ')
    echo "Транзакций сегодня: ${transactions:-0}"
    
    # Общая выручка
    local revenue=$(docker-compose exec -T postgres psql -U vpn_user vpn_db -t -c "SELECT COALESCE(SUM(amount), 0) FROM transactions WHERE status='completed' AND type='deposit';" 2>/dev/null | tr -d ' ')
    echo "Выручка: ${revenue:-0} RUB"
    
    echo ""
    
    # Статус сервисов
    docker-compose ps
}

cmd_env_edit() {
    cd "$PROJECT_DIR"
    
    if [[ ! -f .env ]]; then
        error ".env файл не найден"
    fi
    
    echo ""
    echo "=========================================="
    echo "   Редактор .env конфигурации            "
    echo "=========================================="
    echo ""
    
    # Показать текущие значения
    info "Текущие значения:"
    echo ""
    printf "%-30s | %s\n" "Параметр" "Значение"
    printf "%-30s-+-%s\n" "──────────────────────────────" "──────────────────────────────"
    printf "%-30s | %s\n" "NODE_ENV" "$(grep '^NODE_ENV=' .env | cut -d'=' -f2)"
    printf "%-30s | %s\n" "PORT" "$(grep '^PORT=' .env | cut -d'=' -f2)"
    printf "%-30s | %s\n" "DOMAIN" "$(grep '^XRAY_TLS_DOMAIN=' .env | cut -d'=' -f2)"
    printf "%-30s | %s\n" "DB_HOST" "$(grep '^DB_HOST=' .env | cut -d'=' -f2)"
    printf "%-30s | %s\n" "DB_NAME" "$(grep '^DB_NAME=' .env | cut -d'=' -f2)"
    printf "%-30s | %s\n" "TELEGRAM_BOT_TOKEN" "$(grep '^TELEGRAM_BOT_TOKEN=' .env | cut -d'=' -f2 | head -c 20)..."
    printf "%-30s | %s\n" "YOOKASSA_SHOP_ID" "$(grep '^YOOKASSA_SHOP_ID=' .env | cut -d'=' -f2)"
    printf "%-30s | %s\n" "JWT_SECRET" "$(grep '^JWT_SECRET=' .env | cut -d'=' -f2 | head -c 20)..."
    printf "%-30s | %s\n" "GRAFANA_ADMIN_PASSWORD" "$(grep '^GRAFANA_ADMIN_PASSWORD=' .env | cut -d'=' -f2)"
    printf "%-30s | %s\n" "ADMIN_EMAIL" "$(grep '^ADMIN_EMAIL=' .env | cut -d'=' -f2)"
    echo ""
    
    # Предложить редактирование
    read -p "Хотите отредактировать .env? (y/N): " confirm
    
    if [[ "$confirm" != "y" ]] && [[ "$confirm" != "Y" ]]; then
        info "Пропуск"
        return
    fi
    
    echo ""
    info "Выберите способ редактирования:"
    echo "  1) Быстрое редактирование (ключевые параметры)"
    echo "  2) Полное редактирование (текстовый редактор)"
    echo ""
    read -p "Ваш выбор (1-2): " choice
    
    case $choice in
        1)
            echo ""
            info "Введите новые значения (Enter = сохранить текущее):"
            echo ""
            
            # DOMAIN
            current=$(grep '^XRAY_TLS_DOMAIN=' .env | cut -d'=' -f2)
            read -p "XRAY_TLS_DOMAIN [$current]: " val
            [[ -n "$val" ]] && sed -i "s|^XRAY_TLS_DOMAIN=.*|XRAY_TLS_DOMAIN=$val|" .env
            
            # TELEGRAM_BOT_TOKEN
            current=$(grep '^TELEGRAM_BOT_TOKEN=' .env | cut -d'=' -f2)
            read -p "TELEGRAM_BOT_TOKEN [текущее]: " val
            [[ -n "$val" ]] && sed -i "s/^TELEGRAM_BOT_TOKEN=.*/TELEGRAM_BOT_TOKEN=$val/" .env
            
            # YOOKASSA_SHOP_ID
            current=$(grep '^YOOKASSA_SHOP_ID=' .env | cut -d'=' -f2)
            read -p "YOOKASSA_SHOP_ID [текущее]: " val
            [[ -n "$val" ]] && sed -i "s/^YOOKASSA_SHOP_ID=.*/YOOKASSA_SHOP_ID=$val/" .env
            
            # YOOKASSA_SECRET_KEY
            current=$(grep '^YOOKASSA_SECRET_KEY=' .env | cut -d'=' -f2)
            read -p "YOOKASSA_SECRET_KEY [текущее]: " val
            [[ -n "$val" ]] && sed -i "s/^YOOKASSA_SECRET_KEY=.*/YOOKASSA_SECRET_KEY=$val/" .env
            
            # ADMIN_EMAIL
            current=$(grep '^ADMIN_EMAIL=' .env | cut -d'=' -f2)
            read -p "ADMIN_EMAIL [$current]: " val
            [[ -n "$val" ]] && sed -i "s/^ADMIN_EMAIL=.*/ADMIN_EMAIL=$val/" .env
            
            success "Конфигурация обновлена"
            ;;
        2)
            if command -v nano &> /dev/null; then
                nano .env
            elif command -v vim &> /dev/null; then
                vim .env
            else
                warn "Редактор не найден. Установите nano: apt-get install nano"
                cat .env
            fi
            success "Редактирование завершено"
            ;;
        *)
            warn "Неверный выбор"
            ;;
    esac
    
    # Перезапуск сервисов
    echo ""
    read -p "Перезапустить сервисы для применения изменений? (y/N): " restart_confirm
    if [[ "$restart_confirm" == "y" ]] || [[ "$restart_confirm" == "Y" ]]; then
        cmd_restart
    fi
}

cmd_help() {
    head -25 "$0" | tail -22
}

# Основная логика
case "${1:-help}" in
    start)
        cmd_start
        ;;
    stop)
        cmd_stop
        ;;
    restart)
        cmd_restart
        ;;
    status)
        cmd_status
        ;;
    logs)
        cmd_logs "$2" "$3"
        ;;
    backup)
        cmd_backup
        ;;
    restore)
        cmd_restore "$2"
        ;;
    update)
        cmd_update
        ;;
    db:migrate)
        cmd_db_migrate
        ;;
    db:seed)
        cmd_db_seed
        ;;
    admin:create)
        cmd_admin_create
        ;;
    stats)
        cmd_stats
        ;;
    env:edit)
        cmd_env_edit
        ;;
    help|--help|-h)
        cmd_help
        ;;
    *)
        error "Неизвестная команда: $1"
        ;;
esac
