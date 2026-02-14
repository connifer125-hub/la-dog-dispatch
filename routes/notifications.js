const express = require('express');
const db = require('../config/database');
const router = express.Router();

// Subscribe to email alerts
router.post('/subscribe', async (req, res) => {
  try {
    const { email, name, categories } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    const result = await db.query(
      `INSERT INTO email_subscribers (email, name, categories)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) 
       DO UPDATE SET categories = $3, active = true
       RETURNING *`,
      [email, name, categories || ['general', 'medical', 'ice', 'death']]
    );

    res.status(201).json({
      message: 'Subscribed to email alerts',
      subscriber: result.rows[0]
    });
  } catch (error) {
    console.error('Error subscribing:', error);
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

// Unsubscribe from alerts
router.post('/unsubscribe', async (req, res) => {
  try {
    const { email } = req.body;

    await db.query(
      'UPDATE email_subscribers SET active = false WHERE email = $1',
      [email]
    );

    res.json({ message: 'Unsubscribed successfully' });
  } catch (error) {
    console.error('Error unsubscribing:', error);
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

module.exports = router;
