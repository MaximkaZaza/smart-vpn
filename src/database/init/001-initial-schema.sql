-- Smart VPN Database Initialization Script
-- PostgreSQL 15+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE IF NOT EXISTS user_role AS ENUM ('user', 'admin', 'superadmin');
CREATE TYPE IF NOT EXISTS plan_duration AS ENUM ('1month', '3months', '6months', '1year');
CREATE TYPE IF NOT EXISTS currency_type AS ENUM ('RUB', 'USD', 'EUR', 'BTC', 'ETH', 'USDT');
CREATE TYPE IF NOT EXISTS transaction_type AS ENUM ('deposit', 'payment', 'refund', 'bonus', 'referral');
CREATE TYPE IF NOT EXISTS transaction_status AS ENUM ('pending', 'completed', 'failed', 'cancelled');
CREATE TYPE IF NOT EXISTS payment_method AS ENUM ('card', 'crypto', 'yookassa', 'stripe', 'qiwi', 'bonus');
CREATE TYPE IF NOT EXISTS server_protocol AS ENUM ('VLESS', 'VMESS', 'TROJAN', 'SHADOWSOCKS');
CREATE TYPE IF NOT EXISTS server_health AS ENUM ('healthy', 'degraded', 'unhealthy', 'unknown');

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    telegram_id BIGINT UNIQUE,
    username VARCHAR(255) NOT NULL UNIQUE,
    email VARCHAR(255) UNIQUE,
    password_hash VARCHAR(255),
    balance DECIMAL(10, 2) DEFAULT 0.00,
    ref_code VARCHAR(50) UNIQUE NOT NULL,
    referred_by UUID REFERENCES users(id),
    is_active BOOLEAN DEFAULT true,
    role user_role DEFAULT 'user',
    last_login_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on telegram_id
CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_users_ref_code ON users(ref_code);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Plans table
CREATE TABLE IF NOT EXISTS plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10, 2) NOT NULL,
    currency currency_type DEFAULT 'RUB',
    duration plan_duration DEFAULT '1month',
    duration_days INTEGER DEFAULT 30,
    traffic_limit_gb INTEGER DEFAULT 100,
    device_limit INTEGER DEFAULT 1,
    speed_limit_mbps INTEGER,
    features JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    is_popular BOOLEAN DEFAULT false,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_plans_is_active ON plans(is_active);
CREATE INDEX IF NOT EXISTS idx_plans_currency ON plans(currency);

-- Servers table
CREATE TABLE IF NOT EXISTS servers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    region VARCHAR(255) NOT NULL,
    country VARCHAR(255) NOT NULL,
    ip_address VARCHAR(45) NOT NULL,
    port INTEGER DEFAULT 443,
    protocol server_protocol DEFAULT 'VLESS',
    is_active BOOLEAN DEFAULT true,
    is_primary BOOLEAN DEFAULT false,
    health_status server_health DEFAULT 'unknown',
    last_health_check TIMESTAMP,
    max_connections INTEGER DEFAULT 1000,
    current_connections INTEGER DEFAULT 0,
    load_percentage FLOAT DEFAULT 0,
    config JSONB DEFAULT '{}',
    metrics JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_servers_is_active ON servers(is_active);
CREATE INDEX IF NOT EXISTS idx_servers_region ON servers(region);
CREATE INDEX IF NOT EXISTS idx_servers_health ON servers(health_status);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES plans(id),
    vless_uuid UUID UNIQUE DEFAULT uuid_generate_v4(),
    start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_date TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT true,
    traffic_limit_gb INTEGER DEFAULT 0,
    traffic_used_gb FLOAT DEFAULT 0,
    device_limit INTEGER DEFAULT 1,
    server_id UUID REFERENCES servers(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_vless_uuid ON subscriptions(vless_uuid);
CREATE INDEX IF NOT EXISTS idx_subscriptions_is_active ON subscriptions(is_active);
CREATE INDEX IF NOT EXISTS idx_subscriptions_end_date ON subscriptions(end_date);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    currency currency_type DEFAULT 'RUB',
    type transaction_type DEFAULT 'deposit',
    status transaction_status DEFAULT 'pending',
    payment_method payment_method,
    payment_gateway_id VARCHAR(255),
    description TEXT,
    metadata JSONB DEFAULT '{}',
    paid_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_gateway_id ON transactions(payment_gateway_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_servers_updated_at BEFORE UPDATE ON servers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default plans
INSERT INTO plans (name, description, price, currency, duration, duration_days, traffic_limit_gb, device_limit, is_popular, sort_order) VALUES
('Стартовый', 'Базовый тариф для начала работы', 299, 'RUB', '1month', 30, 50, 1, false, 1),
('Оптимальный', 'Популярный тариф с лучшим соотношением цены и качества', 799, 'RUB', '3months', 90, 200, 2, true, 2),
('Продвинутый', 'Для активных пользователей', 1499, 'RUB', '6months', 180, 500, 3, false, 3),
('Безлимитный', 'Максимальные возможности', 2499, 'RUB', '1year', 365, 1000, 5, false, 4)
ON CONFLICT DO NOTHING;

-- Insert default server (placeholder)
INSERT INTO servers (name, region, country, ip_address, port, protocol, is_primary, health_status) VALUES
('Main Server', 'Europe', 'Netherlands', '0.0.0.0', 443, 'VLESS', true, 'unknown')
ON CONFLICT DO NOTHING;

-- Create view for active subscriptions
CREATE OR REPLACE VIEW active_subscriptions AS
SELECT 
    s.id,
    s.user_id,
    u.username,
    u.telegram_id,
    s.plan_id,
    p.name as plan_name,
    s.vless_uuid,
    s.start_date,
    s.end_date,
    s.traffic_limit_gb,
    s.traffic_used_gb,
    s.device_limit,
    srv.name as server_name,
    srv.ip_address as server_ip,
    EXTRACT(DAY FROM (s.end_date - CURRENT_TIMESTAMP)) as days_remaining
FROM subscriptions s
JOIN users u ON s.user_id = u.id
JOIN plans p ON s.plan_id = p.id
LEFT JOIN servers srv ON s.server_id = srv.id
WHERE s.is_active = true AND s.end_date > CURRENT_TIMESTAMP;

-- Create view for user statistics
CREATE OR REPLACE VIEW user_statistics AS
SELECT 
    u.id,
    u.username,
    u.email,
    u.balance,
    u.role,
    COUNT(DISTINCT s.id) as total_subscriptions,
    COUNT(DISTINCT CASE WHEN s.is_active AND s.end_date > CURRENT_TIMESTAMP THEN 1 END) as active_subscriptions,
    COALESCE(SUM(CASE WHEN t.status = 'completed' AND t.type = 'deposit' THEN t.amount ELSE 0 END), 0) as total_deposits,
    COUNT(DISTINCT r.id) as referrals_count
FROM users u
LEFT JOIN subscriptions s ON u.id = s.user_id
LEFT JOIN transactions t ON u.id = t.user_id
LEFT JOIN users r ON u.id = r.referred_by
GROUP BY u.id, u.username, u.email, u.balance, u.role;

-- Grant permissions (adjust as needed)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO vpn_user;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO vpn_user;

COMMENT ON TABLE users IS 'Пользователи VPN сервиса';
COMMENT ON TABLE plans IS 'Тарифные планы';
COMMENT ON TABLE servers IS 'VPN серверы';
COMMENT ON TABLE subscriptions IS 'Подписки пользователей';
COMMENT ON TABLE transactions IS 'Финансовые транзакции';
