const express = require('express');
const router = express.Router();
const db = require('../config/database');

const stripe = process.env.STRIPE_SECRET_KEY
  ? require('stripe')(process.env.STRIPE_SECRET_KEY)
  : null;

const BASE_URL = process.env.BASE_URL || 'https://la-dog-dispatch-production.up.railway.app';

// ── POST /api/stripe/checkout ──────────────────────────────────────
// Creates a Stripe Checkout session for funding a specific dog
router.post('/checkout', async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Stripe not configured yet — check back soon!' });

  try {
    const { dog_id, dog_name, shelter_id, shelter, amount_cents } = req.body;

    if (!dog_id || !amount_cents || amount_cents < 100) {
      return res.status(400).json({ error: 'Dog and amount required (minimum $1)' });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      payment_method_options: {
        card: { request_three_d_secure: 'automatic' }
      },
      // Enables Apple Pay, Google Pay automatically
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Fund ${dog_name} — LA Dog Dispatch`,
            description: `${shelter} · Your donation goes directly to the rescue that pulls ${dog_name}.`,
            images: [],
          },
          unit_amount: amount_cents,
        },
        quantity: 1,
      }],
      metadata: {
        dog_id: String(dog_id),
        dog_name: dog_name || '',
        shelter_id: shelter_id || '',
        shelter: shelter || '',
        type: 'dog_fund',
      },
      // Collect donor email for follow-up comms
      customer_creation: 'always',
      billing_address_collection: 'auto',
      success_url: `${BASE_URL}/donate.html?success=dog&dog=${encodeURIComponent(dog_name)}&amount=${amount_cents}`,
      cancel_url: `${BASE_URL}/#dogs-section`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('❌ Stripe checkout error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/stripe/member-checkout ──────────────────────────────
// Creates a Stripe Checkout session for recurring membership
router.post('/member-checkout', async (req, res) => {
  if (!stripe) return res.status(503).json({ error: 'Stripe not configured yet — check back soon!' });

  try {
    const { amount_cents } = req.body;

    if (!amount_cents || amount_cents < 100) {
      return res.status(400).json({ error: 'Amount required (minimum $1/mo)' });
    }

    // Create or retrieve a recurring price dynamically
    const price = await stripe.prices.create({
      currency: 'usd',
      unit_amount: amount_cents,
      recurring: { interval: 'month' },
      product_data: {
        name: 'LA Dog Dispatch Monthly Membership',
      },
    });

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: price.id, quantity: 1 }],
      metadata: {
        type: 'membership',
      },
      customer_creation: 'always',
      success_url: `${BASE_URL}/how-it-works.html?success=member&amount=${amount_cents}`,
      cancel_url: `${BASE_URL}/donate.html`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('❌ Stripe member checkout error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/stripe/webhook ───────────────────────────────────────
// Stripe calls this after successful payment — store donor info + send email
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('❌ Webhook signature error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const meta = session.metadata || {};
    const amountCents = session.amount_total;
    const donorEmail = session.customer_details?.email;
    const donorName = session.customer_details?.name;

    try {
      // Ensure donations table exists
      await db.query(`
        CREATE TABLE IF NOT EXISTS donations (
          id SERIAL PRIMARY KEY,
          stripe_session_id VARCHAR(255) UNIQUE,
          dog_id INTEGER,
          dog_name VARCHAR(255),
          shelter_id VARCHAR(100),
          shelter VARCHAR(255),
          donor_email VARCHAR(255),
          donor_name VARCHAR(255),
          amount_cents INTEGER,
          type VARCHAR(50),
          notified_rescue BOOLEAN DEFAULT FALSE,
          notified_donor_rescued BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);

      await db.query(
        `INSERT INTO donations 
          (stripe_session_id, dog_id, dog_name, shelter_id, shelter, donor_email, donor_name, amount_cents, type)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         ON CONFLICT (stripe_session_id) DO NOTHING`,
        [
          session.id,
          meta.dog_id ? parseInt(meta.dog_id) : null,
          meta.dog_name || null,
          meta.shelter_id || null,
          meta.shelter || null,
          donorEmail,
          donorName,
          amountCents,
          meta.type || 'dog_fund',
        ]
      );

      console.log(`💰 Donation recorded: $${(amountCents/100).toFixed(2)} from ${donorEmail} for ${meta.dog_name || 'membership'}`);

      // TODO: Send thank-you email via SendGrid (Phase 2)
      // TODO: When rescue commits, email all donors for that dog_id (Phase 2)

    } catch (err) {
      console.error('❌ Error storing donation:', err.message);
    }
  }

  res.json({ received: true });
});

module.exports = router;
