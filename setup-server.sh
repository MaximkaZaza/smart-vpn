#!/bin/bash

################################################################################
# Smart VPN — Скрипт настройки сервера (pre-install)
# Запускается ПЕРЕД основным скриптом развёртывания
################################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

info() { echo -e "${BLUE}[INFO]${NC} $@"; }
success() { echo -e "${GREEN}[OK]${NC} $@"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $@"; }
error() { echo -e "${RED}[ERROR]${NC} $@"; exit 1; }

echo ""
echo "=========================================="
echo "   Smart VPN Server Setup                "
echo "=========================================="
echo ""

# Проверка root
if [[ $EUID -ne 0 ]]; then
    error "Требуется запуск от root"
fi

# Обновление системы
info "Обновление системы..."
apt-get update && apt-get upgrade -y
success "Система обновлена"

# Установка базовых пакетов
info "Установка базовых пакетов..."
apt-get install -y \
    curl \
    wget \
    git \
    vim \
    htop \
    net-tools \
    ufw \
    fail2ban \
    unattended-upgrades \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release \
    software-properties-common
success "Базовые пакеты установлены"

# Настройка часового пояса
info "Настройка часового пояса..."
timedatectl set-timezone Europe/Moscow 2>/dev/null || true
success "Часовой пояс установлен"

# Настройка Swap (если нужно)
if [[ $(free -m | awk '/^Swap:/{print $2}') -lt 1000 ]]; then
    info "Настройка Swap..."
    fallocate -l 2G /swapfile 2>/dev/null || true
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
    success "Swap настроен (2GB)"
fi

# Установка Docker
if ! command -v docker &> /dev/null; then
    info "Установка Docker..."
    
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io
    
    success "Docker установлен"
else
    success "Docker уже установлен"
fi

# Установка Docker Compose
if ! command -v docker-compose &> /dev/null; then
    info "Установка Docker Compose..."
    apt-get install -y docker-compose
    success "Docker Compose установлен"
else
    success "Docker Compose уже установлен"
fi

# Установка Nginx
if ! command -v nginx &> /dev/null; then
    info "Установка Nginx..."
    apt-get install -y nginx
    systemctl enable nginx
    success "Nginx установлен"
else
    success "Nginx уже установлен"
fi

# Установка Certbot
if ! command -v certbot &> /dev/null; then
    info "Установка Certbot..."
    apt-get install -y certbot python3-certbot-nginx
    success "Certbot установлен"
else
    success "Certbot уже установлен"
fi

# Настройка UFW Firewall
info "Настройка firewall..."
ufw --force reset

# Разрешить SSH
ufw allow 22/tcp

# Разрешить HTTP/HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Разрешить VPN (UDP)
ufw allow 443/udp

# Включить UFW
echo "y" | ufw enable

success "Firewall настроен"

# Настройка Fail2Ban
info "Настройка Fail2Ban..."
cat > /etc/fail2ban/jail.d/smart-vpn.conf << 'EOF'
[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 3600
findtime = 600

[nginx-http-auth]
enabled = true
port = http,https
filter = nginx-http-auth
logpath = /var/log/nginx/error.log
maxretry = 3
bantime = 3600
EOF

systemctl restart fail2ban
success "Fail2Ban настроен"

# Настройка автоматических обновлений
info "Настройка автоматических обновлений..."
cat > /etc/apt/apt.conf.d/50unattended-upgrades << 'EOF'
Unattended-Upgrade::Allowed-Origins::
    "${distro_id}:${distro_codename}";
    "${distro_id}:${distro_codename}-security";
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "03:00";
EOF

systemctl enable unattended-upgrades
success "Автоматические обновления включены"

# Оптимизация системных параметров
info "Оптимизация системы..."
cat >> /etc/sysctl.conf << 'EOF'

# Smart VPN Optimizations
net.core.somaxconn = 65535
net.ipv4.tcp_max_syn_backlog = 65535
net.ipv4.ip_local_port_range = 1024 65535
net.ipv4.tcp_fin_timeout = 30
net.ipv4.tcp_keepalive_time = 1200
net.ipv4.tcp_tw_reuse = 1
EOF

sysctl -p
success "Система оптимизирована"

# Создание пользователя для Docker (если есть SUDO_USER)
if [[ -n "$SUDO_USER" ]]; then
    usermod -aG docker "$SUDO_USER" 2>/dev/null || true
    success "Пользователь $SUDO_USER добавлен в группу docker"
fi

# Создание директорий
mkdir -p /opt/smart-vpn
mkdir -p /opt/backups/smart-vpn
mkdir -p /var/log/smart-vpn

success "Директории созданы"

# Итог
echo ""
echo "=========================================="
echo "     Сервер настроен успешно!            "
echo "=========================================="
echo ""
echo "Следующий шаг: запустите ./deploy.sh"
echo ""

# Перезагрузка рекомендуется
warn "Рекомендуется перезагрузить сервер:"
echo "  sudo reboot"
echo ""
