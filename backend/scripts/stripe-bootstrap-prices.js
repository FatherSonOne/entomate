#!/usr/bin/env node
/**
 * Create Entomate's Stripe products and prices (approved pricing 2026-11-22).
 * Safe to run again: a product or price that already exists is reused.
 *
 *   STRIPE_SECRET_KEY=sk_test_... node scripts/stripe-bootstrap-prices.js
 *
 * The backend finds each price by its lookup key (services/stripeBilling.js),
 * so nothing has to be copied into the backend config afterwards.
 */
const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error('Set STRIPE_SECRET_KEY first.');
  process.exit(1);
}
const stripe = require('stripe')(key);

const PRODUCTS = [
  {
    id: 'entomate_solo',
    name: 'Entomate Solo',
    description: '1 seat, 15 bot hours a month, unlimited browser recordings.',
    prices: [
      { lookup_key: 'entomate_solo_monthly', unit_amount: 2000, recurring: { interval: 'month' } },
      { lookup_key: 'entomate_solo_yearly', unit_amount: 20000, recurring: { interval: 'year' } },
    ],
  },
  {
    id: 'entomate_team',
    name: 'Entomate Team',
    description: 'Unlimited seats, 75 shared bot hours a month.',
    prices: [
      { lookup_key: 'entomate_team_monthly', unit_amount: 10000, recurring: { interval: 'month' } },
      { lookup_key: 'entomate_team_yearly', unit_amount: 100000, recurring: { interval: 'year' } },
    ],
  },
  {
    id: 'entomate_bot_pack_10',
    name: 'Entomate 10 extra bot hours',
    description: 'Ten more meeting-bot hours. They do not expire.',
    prices: [{ lookup_key: 'entomate_bot_pack_10', unit_amount: 1000 }],
  },
];

async function ensureProduct(p) {
  try {
    return await stripe.products.retrieve(p.id);
  } catch (err) {
    if (err.code !== 'resource_missing') throw err;
    return stripe.products.create({ id: p.id, name: p.name, description: p.description });
  }
}

async function main() {
  const mode = key.startsWith('sk_live_') || key.startsWith('rk_live_') ? 'LIVE' : 'test';
  console.log(`Stripe ${mode} mode`);
  for (const p of PRODUCTS) {
    const product = await ensureProduct(p);
    for (const price of p.prices) {
      const { data } = await stripe.prices.list({ lookup_keys: [price.lookup_key], limit: 1 });
      if (data[0]) {
        const same = data[0].unit_amount === price.unit_amount && data[0].active;
        console.log(`${same ? 'exists ' : 'CHECK  '} ${price.lookup_key} ${data[0].id} ${data[0].unit_amount} ${data[0].active ? '' : '(inactive)'}`);
        continue;
      }
      const created = await stripe.prices.create({ product: product.id, currency: 'usd', ...price });
      console.log(`created ${price.lookup_key} ${created.id} ${created.unit_amount}`);
    }
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
