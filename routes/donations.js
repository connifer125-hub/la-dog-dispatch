const express = require('express');
const db = require('../config/database');
const router = express.Router();

// Record a donation
router.post('/', async (req, res) => {
  try {
    const {
      dog_id,
      amount,
      payment_method,
      payment_id,
      donor_email,
      donor_name,
      anonymous,
      message,
      is_recurring
    } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid donation amount' });
    }

    // Insert donation
    const donationResult = await db.query(
      `INSERT INTO donations (
        dog_id, amount, payment_method, payment_id, donor_email,
        donor_name, anonymous, message, is_recurring
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        dog_id || null, amount, payment_method, payment_id, donor_email,
        donor_name, anonymous || false, message, is_recurring || false
      ]
    );

    // Update dog's raised amount if donation is for a specific dog
    if (dog_id) {
      await db.query(
        `UPDATE dogs 
         SET raised_amount = raised_amount + $1,
             updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2`,
        [amount, dog_id]
      );

      // Check if goal is reached
      const dogResult = await db.query(
        'SELECT raised_amount, goal_amount, name FROM dogs WHERE id = $1',
        [dog_id]
      );

      if (dogResult.rows.length > 0) {
        const dog = dogResult.rows[0];
        if (dog.raised_amount >= dog.goal_amount) {
          // Update status to funded
          await db.query(
            'UPDATE dogs SET status = $1 WHERE id = $2',
            ['funded', dog_id]
          );
          
          // TODO: Send notification that goal is reached
          console.log(`🎉 Goal reached for ${dog.name}!`);
        }
      }
    }

    res.status(201).json({
      message: 'Donation recorded successfully',
      donation: donationResult.rows[0]
    });
  } catch (error) {
    console.error('Error recording donation:', error);
    res.status(500).json({ error: 'Failed to record donation' });
  }
});

// Get donations for a specific dog
router.get('/dog/:dogId', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT 
        id, amount, donor_name, message, created_at, anonymous
       FROM donations 
       WHERE dog_id = $1 
       ORDER BY created_at DESC`,
      [req.params.dogId]
    );

    const total = await db.query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM donations WHERE dog_id = $1',
      [req.params.dogId]
    );

    res.json({
      donations: result.rows,
      total: parseFloat(total.rows[0].total)
    });
  } catch (error) {
    console.error('Error fetching donations:', error);
    res.status(500).json({ error: 'Failed to fetch donations' });
  }
});

// Get recent donations (public leaderboard)
router.get('/recent', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT 
        d.amount, d.donor_name, d.message, d.created_at, d.anonymous,
        dog.name as dog_name
       FROM donations d
       LEFT JOIN dogs ON d.dog_id = dogs.id
       WHERE d.anonymous = false
       ORDER BY d.created_at DESC
       LIMIT 20`
    );

    res.json({ donations: result.rows });
  } catch (error) {
    console.error('Error fetching recent donations:', error);
    res.status(500).json({ error: 'Failed to fetch recent donations' });
  }
});

module.exports = router;
