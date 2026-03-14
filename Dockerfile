# Node.js Dockerfile для Smart VPN

FROM node:18-alpine

# Установка зависимостей для production
WORKDIR /app

# Копируем package files
COPY package*.json ./

# Установка зависимостей
RUN npm ci --only=production

# Копируем исходный код
COPY . .

# Создаем директорию для логов
RUN mkdir -p logs

# Экспортируем порт
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node src/healthcheck.js || exit 1

# Запуск приложения
CMD ["node", "src/index.js"]
