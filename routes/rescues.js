const express = require('express');
const db = require('../config/database');
const { authMiddleware, requireRole } = require('../middleware/auth');
const router = express.Router();

// Register as a rescue organization
router.post('/register', authMiddleware, async (req, res) => {
  try {
    const { organization_name, ein_tax_id, rescue_type, capacity, service_area } = req.body;

    if (!organization_name) {
      return res.status(400).json({ error: 'Organization name required' });
    }

    const result = await db.query(
      `INSERT INTO rescues (user_id, organization_name, ein_tax_id, rescue_type, capacity, service_area)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.user.id, organization_name, ein_tax_id, rescue_type, capacity || 0, service_area]
    );

    // Update user role to rescue
    await db.query('UPDATE users SET role = $1 WHERE id = $2', ['rescue', req.user.id]);

    res.status(201).json({
      message: 'Rescue organization registered. Pending verification.',
      rescue: result.rows[0]
    });
  } catch (error) {
    console.error('Error registering rescue:', error);
    res.status(500).json({ error: 'Failed to register rescue' });
  }
});

// Claim a dog for rescue
router.post('/claim/:dogId', authMiddleware, requireRole('rescue'), async (req, res) => {
  try {
    const { pickup_date, notes } = req.body;

    // Get rescue ID for this user
    const rescueResult = await db.query(
      'SELECT id FROM rescues WHERE user_id = $1 AND verified = true',
      [req.user.id]
    );

    if (rescueResult.rows.length === 0) {
      return res.status(403).json({ error: 'Rescue not verified' });
    }

    const rescueId = rescueResult.rows[0].id;

    // Create rescue assignment
    const result = await db.query(
      `INSERT INTO rescue_assignments (dog_id, rescue_id, pickup_date, notes, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.params.dogId, rescueId, pickup_date, notes, 'pending']
    );

    res.status(201).json({
      message: 'Dog claimed successfully. Pending admin approval.',
      assignment: result.rows[0]
    });
  } catch (error) {
    console.error('Error claiming dog:', error);
    res.status(500).json({ error: 'Failed to claim dog' });
  }
});

// Get rescue assignments
router.get('/assignments', authMiddleware, requireRole('rescue'), async (req, res) => {
  try {
    const rescueResult = await db.query(
      'SELECT id FROM rescues WHERE user_id = $1',
      [req.user.id]
    );

    if (rescueResult.rows.length === 0) {
      return res.json({ assignments: [] });
    }

    const result = await db.query(
      `SELECT ra.*, d.name, d.breed, d.age, d.photo_url, d.shelter
       FROM rescue_assignments ra
       JOIN dogs d ON ra.dog_id = d.id
       WHERE ra.rescue_id = $1
       ORDER BY ra.created_at DESC`,
      [rescueResult.rows[0].id]
    );

    res.json({ assignments: result.rows });
  } catch (error) {
    console.error('Error fetching assignments:', error);
    res.status(500).json({ error: 'Failed to fetch assignments' });
  }
});

module.exports = router;
