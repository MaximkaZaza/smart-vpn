const axios = require('axios');
const logger = require('../config/logger');

/**
 * Create payment intent
 * @param {Object} options - Payment options
 * @returns {Object} Payment intent
 */
async function createPaymentIntent(options) {
  const { amount, currency, method, transactionId } = options;

  try {
    if (method === 'card' || method === 'yookassa') {
      // YooKassa integration
      const response = await axios.post(
        'https://api.yookassa.ru/v3/payments',
        {
          amount: {
            value: amount.toString(),
            currency: currency === 'RUB' ? 'RUB' : 'USD'
          },
          confirmation: {
            type: 'redirect',
            return_url: `${process.env.APP_URL}/payment/success?transaction=${transactionId}`
          },
          capture: true,
          description: `Пополнение баланса (транзакция ${transactionId})`,
          metadata: {
            transaction_id: transactionId
          }
        },
        {
          auth: {
            username: process.env.YOOKASSA_SHOP_ID,
            password: process.env.YOOKASSA_SECRET_KEY
          },
          headers: {
            'Content-Type': 'application/json',
            'Idempotence-Key': transactionId
          }
        }
      );

      return {
        id: response.data.id,
        clientSecret: null,
        paymentUrl: response.data.confirmation.confirmation_url,
        status: response.data.status
      };
    } else if (method === 'stripe') {
      // Stripe integration
      const response = await axios.post(
        'https://api.stripe.com/v1/payment_intents',
        new URLSearchParams({
          amount: Math.round(amount * 100), // Stripe uses smallest currency unit
          currency: currency.toLowerCase(),
          automatic_payment_methods: JSON.stringify({ enabled: true })
        }),
        {
          auth: {
            username: process.env.STRIPE_SECRET_KEY,
            password: ''
          },
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      return {
        id: response.data.id,
        clientSecret: response.data.client_secret,
        paymentUrl: null,
        status: response.data.status
      };
    } else if (['btc', 'eth', 'usdt'].includes(method)) {
      // Crypto payment (placeholder - integrate with Coinbase Commerce or similar)
      return {
        id: `crypto_${transactionId}`,
        clientSecret: null,
        paymentUrl: `https://crypto-gateway.example.com/pay?amount=${amount}&currency=${method}&tx=${transactionId}`,
        status: 'pending'
      };
    }

    throw new Error(`Unsupported payment method: ${method}`);
  } catch (error) {
    logger.error('Payment intent creation failed:', error.response?.data || error.message);
    throw new Error('Failed to create payment intent');
  }
}

/**
 * Verify payment
 * @param {Object} options - Verification options
 * @returns {Object} Verification result
 */
async function verifyPayment(options) {
  const { transactionId, paymentData } = options;

  try {
    // YooKassa verification
    const response = await axios.get(
      `https://api.yookassa.ru/v3/payments/${transactionId}`,
      {
        auth: {
          username: process.env.YOOKASSA_SHOP_ID,
          password: process.env.YOOKASSA_SECRET_KEY
        }
      }
    );

    const payment = response.data;
    
    return {
      success: payment.status === 'succeeded',
      status: payment.status,
      amount: payment.amount.value,
      currency: payment.amount.currency
    };
  } catch (error) {
    logger.error('Payment verification failed:', error.response?.data || error.message);
    return {
      success: false,
      status: 'error',
      error: error.message
    };
  }
}

/**
 * Refund payment
 * @param {Object} options - Refund options
 * @returns {Object} Refund result
 */
async function refundPayment(options) {
  const { paymentId, amount, reason } = options;

  try {
    const response = await axios.post(
      'https://api.yookassa.ru/v3/refunds',
      {
        payment_id: paymentId,
        amount: {
          value: amount.toString(),
          currency: 'RUB'
        },
        description: reason || 'Возврат средств'
      },
      {
        auth: {
          username: process.env.YOOKASSA_SHOP_ID,
          password: process.env.YOOKASSA_SECRET_KEY
        },
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    return {
      success: response.data.status === 'succeeded',
      refundId: response.data.id,
      status: response.data.status
    };
  } catch (error) {
    logger.error('Refund failed:', error.response?.data || error.message);
    throw new Error('Failed to process refund');
  }
}

module.exports = {
  createPaymentIntent,
  verifyPayment,
  refundPayment
};
