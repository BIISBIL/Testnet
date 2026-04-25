const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Authorize guest payment and hold funds in platform account.
 */
exports.createPaymentIntentForBooking = async ({ amountCents, currency = 'usd', bookingId, guestCustomerId }) => {
  return stripe.paymentIntents.create({
    amount: amountCents,
    currency,
    customer: guestCustomerId,
    capture_method: 'manual',
    metadata: { bookingId },
  });
};

/**
 * Release host payout after booking end using Stripe Connect transfer.
 */
exports.releaseHostPayout = async ({ destinationAccountId, amountToHostCents, bookingId }) => {
  return stripe.transfers.create({
    amount: amountToHostCents,
    currency: 'usd',
    destination: destinationAccountId,
    metadata: { bookingId },
  });
};
