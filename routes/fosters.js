const express = require('express');
const db = require('../config/database');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

// Submit foster application
router.post('/apply', authMiddleware, async (req, res) => {
  try {
    const {
      home_type, yard_fenced, other_pets, experience_level,
      availability, max_dog_size, special_needs_ok
    } = req.body;

    const result = await db.query(
      `INSERT INTO foster_applications (
        user_id, home_type, yard_fenced, other_pets, experience_level,
        availability, max_dog_size, special_needs_ok
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        req.user.id, home_type, yard_fenced, other_pets, experience_level,
        availability, max_dog_size, special_needs_ok || false
      ]
    );

    res.status(201).json({
      message: 'Foster application submitted successfully',
      application: result.rows[0]
    });
  } catch (error) {
    console.error('Error submitting foster application:', error);
    res.status(500).json({ error: 'Failed to submit application' });
  }
});

// Get user's foster applications
router.get('/my-applications', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM foster_applications WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );

    res.json({ applications: result.rows });
  } catch (error) {
    console.error('Error fetching applications:', error);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

module.exports = router;
