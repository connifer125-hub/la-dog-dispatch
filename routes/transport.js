const express = require('express');
const db = require('../config/database');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

// Get available transport requests
router.get('/available', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT tr.*, d.name, d.breed, d.photo_url
       FROM transport_requests tr
       JOIN dogs d ON tr.dog_id = d.id
       WHERE tr.status = 'needed'
       ORDER BY tr.transport_date ASC`
    );

    res.json({ requests: result.rows });
  } catch (error) {
    console.error('Error fetching transport requests:', error);
    res.status(500).json({ error: 'Failed to fetch transport requests' });
  }
});

// Claim a transport request
router.post('/claim/:id', authMiddleware, async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE transport_requests 
       SET transporter_id = $1, status = 'claimed'
       WHERE id = $2 AND status = 'needed'
       RETURNING *`,
      [req.user.id, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transport request not available' });
    }

    res.json({
      message: 'Transport claimed successfully',
      request: result.rows[0]
    });
  } catch (error) {
    console.error('Error claiming transport:', error);
    res.status(500).json({ error: 'Failed to claim transport' });
  }
});

module.exports = router;
