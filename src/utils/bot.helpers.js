const { User } = require('../models');

/**
 * Get or create user from Telegram
 * @param {Object} userData - Telegram user data
 * @returns {Promise<User>} User instance
 */
async function getOrCreateUser(userData) {
  const { telegramId, username, firstName, lastName } = userData;

  let user = await User.findOne({ where: { telegramId } });

  if (!user) {
    user = await User.create({
      telegramId,
      username: username || `user_${telegramId}`,
      firstName,
      lastName
    });
  }

  // Update username if changed
  if (username && user.username !== username) {
    user.username = username;
    await user.save();
  }

  return user;
}

/**
 * Send message to user by Telegram ID
 * @param {Object} bot - Telegraf bot instance
 * @param {number} telegramId - User's Telegram ID
 * @param {string} message - Message text
 * @returns {Promise<void>}
 */
async function sendMessage(bot, telegramId, message) {
  try {
    await bot.telegram.sendMessage(telegramId, message);
  } catch (error) {
    if (error.response?.error_code === 403) {
      // User blocked the bot
      console.error(`User ${telegramId} blocked the bot`);
    } else {
      throw error;
    }
  }
}

/**
 * Send notification about subscription expiration
 * @param {Object} bot - Telegraf bot instance
 * @param {User} user - User instance
 * @param {number} daysLeft - Days until expiration
 */
async function notifySubscriptionExpiring(bot, user, daysLeft) {
  if (!user.telegramId) return;

  const message = `⚠️ *Ваша подписка скоро истекает*\n\n` +
    `Осталось дней: *${daysLeft}*\n\n` +
    `Продлите подписку, чтобы продолжить пользоваться VPN.\n\n` +
    `Для продления нажмите /menu и выберите «💰 Тарифы».`;

  await sendMessage(bot, user.telegramId, message);
}

/**
 * Send payment confirmation
 * @param {Object} bot - Telegraf bot instance
 * @param {User} user - User instance
 * @param {number} amount - Payment amount
 */
async function notifyPaymentSuccess(bot, user, amount) {
  if (!user.telegramId) return;

  const message = `✅ *Платеж успешен!*\n\n` +
    `Сумма: *${amount} RUB*\n` +
    `Ваш новый баланс: *${user.balance} RUB*\n\n` +
    `Теперь вы можете приобрести подписку в разделе «💰 Тарифы».`;

  await sendMessage(bot, user.telegramId, message);
}

module.exports = {
  getOrCreateUser,
  sendMessage,
  notifySubscriptionExpiring,
  notifyPaymentSuccess
};
