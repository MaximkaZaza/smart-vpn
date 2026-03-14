/**
 * Telegram Bot Entry Point
 */

require('dotenv').config();

const { Telegraf, Markup } = require('telegraf');
const { sequelize, User, Subscription, Plan, Transaction } = require('../models');
const logger = require('../config/logger');
const { generateVLESSConfig } = require('../services/xray.service');
const { getOrCreateUser } = require('../utils/bot.helpers');

// Check bot token
if (!process.env.TELEGRAM_BOT_TOKEN) {
  logger.error('TELEGRAM_BOT_TOKEN is not set in environment variables');
  process.exit(1);
}

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Bot commands
bot.command('start', async (ctx) => {
  try {
    const telegramId = ctx.from.id;
    const username = ctx.from.username;
    const firstName = ctx.from.first_name;
    
    // Get or create user
    const user = await getOrCreateUser({
      telegramId,
      username,
      firstName
    });

    // Check for referral parameter
    const refCode = ctx.startPayload;
    if (refCode && !user.referredBy) {
      const referrer = await User.findOne({ where: { refCode } });
      if (referrer && referrer.id !== user.id) {
        user.referredBy = referrer.id;
        await user.save();
        
        // Bonus for referrer
        referrer.balance = parseFloat(referrer.balance) + 50;
        await referrer.save();
        
        ctx.reply(`🎉 Вы успешно зарегистрировались по приглашению ${referrer.username}!\n\nВам начислено 50 RUB бонуса.`);
        return;
      }
    }

    const welcomeMessage = `👋 Привет, ${firstName}!\n\n` +
      `Я ваш персональный VPN-ассистент.\n\n` +
      `🚀 Быстрый и безопасный VPN\n` +
      `📺 Обход блокировок\n` +
      `🌍 Серверы по всему миру\n\n` +
      `Выберите действие:`;

    await ctx.reply(welcomeMessage, Markup.keyboard([
      ['💰 Тарифы', '👤 Мой аккаунт'],
      ['🔑 Подключить VPN', '💳 Пополнить баланс'],
      ['📞 Поддержка', 'ℹ️ Помощь']
    ]).resize());

  } catch (error) {
    logger.error('Error in /start command:', error);
    ctx.reply('❌ Произошла ошибка. Попробуйте позже.');
  }
});

bot.command('menu', async (ctx) => {
  await ctx.reply('Главное меню:', Markup.keyboard([
    ['💰 Тарифы', '👤 Мой аккаунт'],
    ['🔑 Подключить VPN', '💳 Пополнить баланс'],
    ['📞 Поддержка', 'ℹ️ Помощь']
  ]).resize());
});

bot.command('balance', async (ctx) => {
  try {
    const user = await User.findOne({ where: { telegramId: ctx.from.id } });
    
    if (!user) {
      return ctx.reply('❌ Пользователь не найден. Нажмите /start для регистрации.');
    }

    await ctx.reply(`💰 Ваш баланс: *${user.balance} RUB*\n\n` +
      `Для пополнения выберите «💳 Пополнить баланс» в меню.`, { parse_mode: 'Markdown' });
  } catch (error) {
    logger.error('Error in /balance command:', error);
    ctx.reply('❌ Произошла ошибка.');
  }
});

bot.command('subscription', async (ctx) => {
  try {
    const user = await User.findOne({ 
      where: { telegramId: ctx.from.id },
      include: [{
        model: Subscription,
        where: { isActive: true, endDate: { $gte: new Date() } },
        include: [{ model: Plan }]
      }]
    });

    if (!user || !user.subscriptions || user.subscriptions.length === 0) {
      return ctx.reply('❌ У вас нет активной подписки.\n\n' +
        'Выберите тариф в разделе «💰 Тарифы» для подключения.');
    }

    const sub = user.subscriptions[0];
    const daysLeft = Math.ceil((sub.endDate - new Date()) / (1000 * 60 * 60 * 24));
    const trafficPercent = sub.trafficLimitGB > 0 
      ? ((sub.trafficUsedGB / sub.trafficLimitGB) * 100).toFixed(1)
      : 0;

    const message = `📊 *Ваша подписка*\n\n` +
      `Тариф: *${sub.plan.name}*\n` +
      `Осталось дней: *${daysLeft}*\n` +
      `Трафик: *${trafficPercent}%* использовано\n` +
      `Устройств: *${sub.deviceLimit}*\n\n` +
      `Для получения конфигурации нажмите «🔑 Подключить VPN».`;

    await ctx.reply(message, { parse_mode: 'Markdown' });
  } catch (error) {
    logger.error('Error in /subscription command:', error);
    ctx.reply('❌ Произошла ошибка.');
  }
});

// Button handlers
bot.on('text', async (ctx) => {
  const text = ctx.message.text;

  try {
    switch (text) {
      case '💰 Тарифы':
        await handleTariffs(ctx);
        break;
      case '👤 Мой аккаунт':
        await handleAccount(ctx);
        break;
      case '🔑 Подключить VPN':
        await handleConnectVPN(ctx);
        break;
      case '💳 Пополнить баланс':
        await handleTopUp(ctx);
        break;
      case '📞 Поддержка':
        await handleSupport(ctx);
        break;
      case 'ℹ️ Помощь':
        await handleHelp(ctx);
        break;
      default:
        ctx.reply('Выберите действие из меню.');
    }
  } catch (error) {
    logger.error('Error handling button:', error);
    ctx.reply('❌ Произошла ошибка. Попробуйте позже.');
  }
});

// Handler functions
async function handleTariffs(ctx) {
  const plans = await Plan.findAll({
    where: { isActive: true },
    order: [['sortOrder', 'ASC'], ['price', 'ASC']]
  });

  if (plans.length === 0) {
    return ctx.reply('❌ Тарифы временно недоступны.');
  }

  const keyboard = plans.map(plan => 
    [Markup.button.callback(`💳 ${plan.name} - ${plan.price} RUB`, `buy_${plan.id}`)]
  );

  let message = '💰 *Доступные тарифы:*\n\n';
  
  plans.forEach((plan, index) => {
    message += `*${index + 1}. ${plan.name}* — ${plan.price} RUB\n`;
    message += `   📦 Трафик: ${plan.trafficLimitGB} GB\n`;
    message += `   📱 Устройств: ${plan.deviceLimit}\n`;
    message += `   ⏱ Период: ${plan.durationDays} дн.\n\n`;
  });

  await ctx.reply(message, { 
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard(keyboard)
  });
}

async function handleAccount(ctx) {
  const user = await User.findOne({ where: { telegramId: ctx.from.id } });
  
  if (!user) {
    return ctx.reply('❌ Пользователь не найден.');
  }

  const activeSubs = await Subscription.count({
    where: { userId: user.id, isActive: true, endDate: { $gte: new Date() } }
  });

  const message = `👤 *Ваш аккаунт*\n\n` +
    `Имя: ${user.username || user.firstName}\n` +
    `Баланс: *${user.balance} RUB*\n` +
    `Активных подписок: *${activeSubs}*\n` +
    `Реферальный код: \`${user.refCode}\`\n\n` +
    `Пригласите друзей и получите бонусы!`;

  await ctx.reply(message, { 
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('📢 Пригласить друга', 'referral')],
      [Markup.button.callback('💳 История платежей', 'payment_history')]
    ])
  });
}

async function handleConnectVPN(ctx) {
  const user = await User.findOne({
    where: { telegramId: ctx.from.id },
    include: [{
      model: Subscription,
      where: { isActive: true, endDate: { $gte: new Date() } },
      include: [{ model: Plan }]
    }]
  });

  if (!user || !user.subscriptions || user.subscriptions.length === 0) {
    return ctx.reply('❌ У вас нет активной подписки.\n\n' +
      'Приобретите тариф в разделе «💰 Тарифы».');
  }

  const subscription = user.subscriptions[0];
  
  // Generate VLESS config
  const config = generateVLESSConfig({
    uuid: subscription.vlessUuid,
    server: {
      name: 'Main Server',
      ipAddress: process.env.VPN_SERVER_IP || 'vpn.example.com',
      port: 443
    },
    subscription
  });

  const message = `🔑 *Ваша конфигурация VPN*\n\n` +
    `Тариф: ${subscription.plan.name}\n` +
    `Срок действия: до ${subscription.endDate.toLocaleDateString()}\n\n` +
    `Для подключения:\n` +
    `1. Скачайте приложение V2RayNG (Android) или Shadowrocket (iOS)\n` +
    `2. Отсканируйте QR-код или используйте ссылку ниже`;

  await ctx.reply(message, { parse_mode: 'Markdown' });
  await ctx.replyWithPhoto({ source: Buffer.from(config.qrCode.replace('data:image/png;base64,', ''), 'base64') });
  await ctx.reply(`\`${config.link}\``, { parse_mode: 'Markdown' });
}

async function handleTopUp(ctx) {
  await ctx.reply('💳 *Пополнение баланса*\n\n' +
    'Выберите сумму пополнения:', { parse_mode: 'Markdown' },
    Markup.inlineKeyboard([
      [Markup.button.callback('100 RUB', 'topup_100')],
      [Markup.button.callback('500 RUB', 'topup_500')],
      [Markup.button.callback('1000 RUB', 'topup_1000')],
      [Markup.button.callback('Другая сумма', 'topup_custom')]
    ])
  );
}

async function handleSupport(ctx) {
  await ctx.reply('📞 *Поддержка*\n\n' +
    'Если у вас возникли вопросы или проблемы:\n\n' +
    '📧 Email: support@vpn.example.com\n' +
    '💬 Telegram: @vpn_support\n' +
    '⏰ Время работы: 9:00 - 21:00 (МСК)\n\n' +
    'Опишите вашу проблему, и мы поможем!', { parse_mode: 'Markdown' });
}

async function handleHelp(ctx) {
  const helpMessage = `ℹ️ *Помощь*\n\n` +
    `*Как начать пользоваться:*\n` +
    `1. Выберите тариф в разделе «💰 Тарифы»\n` +
    `2. Оплатите подписку\n` +
    `3. Получите конфигурацию в «🔑 Подключить VPN»\n` +
    `4. Настройте приложение на устройстве\n\n` +
    `*Популярные вопросы:*\n` +
    `• Можно ли использовать на нескольких устройствах? — Да, согласно тарифу\n` +
    `• Как продлить подписку? — Просто оплатите тариф снова\n` +
    `• Что если VPN не работает? — Напишите в поддержку\n\n` +
    `Больше информации: /subscription`;

  await ctx.reply(helpMessage, { parse_mode: 'Markdown' });
}

// Callback query handler
bot.on('callback_query', async (ctx) => {
  const data = ctx.callbackQuery.data;

  try {
    if (data.startsWith('buy_')) {
      const planId = data.split('_')[1];
      const plan = await Plan.findByPk(planId);
      
      if (!plan) {
        return ctx.answerCbQuery('❌ Тариф не найден');
      }

      const user = await User.findOne({ where: { telegramId: ctx.from.id } });
      
      if (user.balance >= plan.price) {
        await ctx.answerCbQuery('✅ Оплата прошла успешно!');
        // Activate subscription logic here
      } else {
        await ctx.answerCbQuery('❌ Недостаточно средств', { show_alert: true });
        await ctx.reply('💳 Недостаточно средств на балансе.\n\n' +
          `Необходимо: ${plan.price} RUB\n` +
          `Ваш баланс: ${user.balance} RUB\n\n` +
          'Пополните баланс в разделе «💳 Пополнить баланс».');
      }
    } else if (data.startsWith('topup_')) {
      const amount = data.split('_')[1];
      await ctx.answerCbQuery();
      await ctx.reply(`💳 Пополнение на ${amount} RUB\n\n` +
        'Выберите способ оплаты:',
        Markup.inlineKeyboard([
          [Markup.button.callback('💳 Банковская карта', `pay_card_${amount}`)],
          [Markup.button.callback('₿ Криптовалюта', `pay_crypto_${amount}`)],
          [Markup.button.callback('↩️ Назад', 'topup')]
        ])
      );
    }
  } catch (error) {
    logger.error('Error in callback query:', error);
    ctx.answerCbQuery('❌ Произошла ошибка');
  }
});

// Error handling
bot.catch((err, ctx) => {
  logger.error('Bot error:', err);
  ctx.reply('❌ Произошла ошибка. Попробуйте позже.');
});

// Graceful shutdown
process.on('SIGINT', () => {
  logger.info('Shutting down bot...');
  bot.stop('SIGINT');
});

process.on('SIGTERM', () => {
  logger.info('Shutting down bot...');
  bot.stop('SIGTERM');
});

// Start bot
async function startBot() {
  try {
    // Test database connection
    await sequelize.authenticate();
    logger.info('Database connected for bot');

    // Launch bot
    await bot.launch();
    logger.info('Telegram bot started successfully');

    // Enable graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));

  } catch (error) {
    logger.error('Failed to start bot:', error);
    process.exit(1);
  }
}

// Export for webhook mode
module.exports = { bot, startBot };

// Start if run directly
if (require.main === module) {
  startBot();
}
