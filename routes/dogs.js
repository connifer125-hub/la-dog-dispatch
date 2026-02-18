const express = require('express');
const db = require('../config/database');
const { authMiddleware, requireRole } = require('../middleware/auth');
const router = express.Router();

// Get all urgent dogs (public)
router.get('/', async (req, res) => {
  try {
    const { category, status } = req.query;
    
    let query = 'SELECT * FROM dogs WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (category && category !== 'all') {
      query += ` AND category = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }

    if (status) {
      query += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    } else {
      // Default to showing urgent dogs only
      query += ` AND status = $${paramIndex}`;
      params.push('urgent');
      paramIndex++;
    }

    query += ' ORDER BY shelter ASC, deadline ASC, created_at DESC';

    const result = await db.query(query, params);
    res.json({ dogs: result.rows });
  } catch (error) {
    console.error('Error fetching dogs:', error);
    res.status(500).json({ error: 'Failed to fetch dogs' });
  }
});

// Get single dog details
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM dogs WHERE id = $1', [req.params.id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dog not found' });
    }

    // Also get donations for this dog
    const donations = await db.query(
      `SELECT amount, donor_name, message, created_at, anonymous 
       FROM donations 
       WHERE dog_id = $1 AND anonymous = false 
       ORDER BY created_at DESC 
       LIMIT 10`,
      [req.params.id]
    );

    res.json({ 
      dog: result.rows[0],
      recent_donations: donations.rows
    });
  } catch (error) {
    console.error('Error fetching dog:', error);
    res.status(500).json({ error: 'Failed to fetch dog details' });
  }
});

// Add new dog manually (admin/rescue only)
router.post('/', authMiddleware, requireRole('admin', 'rescue'), async (req, res) => {
  try {
    const {
      name, breed, age, gender, shelter, deadline, photo_url,
      description, category, goal_amount
    } = req.body;

    if (!name || !breed || !deadline) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await db.query(
      `INSERT INTO dogs (
        name, breed, age, gender, shelter, deadline, photo_url,
        description, source, category, goal_amount, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        name, breed, age, gender, shelter, deadline, photo_url,
        description, 'manual', category || 'general', goal_amount || 500, 'urgent'
      ]
    );

    res.status(201).json({
      message: 'Dog added successfully',
      dog: result.rows[0]
    });
  } catch (error) {
    console.error('Error adding dog:', error);
    res.status(500).json({ error: 'Failed to add dog' });
  }
});

// Update dog status (admin/rescue only)
router.patch('/:id/status', authMiddleware, requireRole('admin', 'rescue'), async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['urgent', 'funded', 'rescued', 'adopted'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const result = await db.query(
      'UPDATE dogs SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dog not found' });
    }

    res.json({
      message: 'Status updated',
      dog: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating status:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// Get statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const urgent = await db.query('SELECT COUNT(*) FROM dogs WHERE status = $1', ['urgent']);
    const rescued = await db.query('SELECT COUNT(*) FROM dogs WHERE status IN ($1, $2)', ['rescued', 'adopted']);
    const totalRaised = await db.query('SELECT COALESCE(SUM(amount), 0) as total FROM donations');

    res.json({
      urgent: parseInt(urgent.rows[0].count),
      rescued: parseInt(rescued.rows[0].count),
      totalRaised: parseFloat(totalRaised.rows[0].total)
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

module.exports = router;
