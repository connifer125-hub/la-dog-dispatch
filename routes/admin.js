const express = require('express');
const db = require('../config/database');
const { authMiddleware, requireRole } = require('../middleware/auth');
const router = express.Router();

// All routes require admin role
router.use(authMiddleware);
router.use(requireRole('admin'));

// Get all pending rescue applications
router.get('/rescues/pending', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT r.*, u.email, u.name, u.phone
       FROM rescues r
       JOIN users u ON r.user_id = u.id
       WHERE r.verified = false
       ORDER BY r.created_at DESC`
    );

    res.json({ rescues: result.rows });
  } catch (error) {
    console.error('Error fetching pending rescues:', error);
    res.status(500).json({ error: 'Failed to fetch pending rescues' });
  }
});

// Approve/reject rescue
router.patch('/rescues/:id/verify', async (req, res) => {
  try {
    const { verified } = req.body;

    const result = await db.query(
      'UPDATE rescues SET verified = $1 WHERE id = $2 RETURNING *',
      [verified, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Rescue not found' });
    }

    // Update user verification
    await db.query(
      'UPDATE users SET verified = $1 WHERE id = $2',
      [verified, result.rows[0].user_id]
    );

    res.json({
      message: verified ? 'Rescue verified' : 'Rescue rejected',
      rescue: result.rows[0]
    });
  } catch (error) {
    console.error('Error verifying rescue:', error);
    res.status(500).json({ error: 'Failed to verify rescue' });
  }
});

// Get all pending foster applications
router.get('/fosters/pending', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT fa.*, u.email, u.name, u.phone
       FROM foster_applications fa
       JOIN users u ON fa.user_id = u.id
       WHERE fa.status = 'pending'
       ORDER BY fa.created_at DESC`
    );

    res.json({ applications: result.rows });
  } catch (error) {
    console.error('Error fetching foster applications:', error);
    res.status(500).json({ error: 'Failed to fetch applications' });
  }
});

// Approve/reject foster application
router.patch('/fosters/:id/status', async (req, res) => {
  try {
    const { status } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const result = await db.query(
      'UPDATE foster_applications SET status = $1 WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    // If approved, update user role
    if (status === 'approved') {
      await db.query(
        'UPDATE users SET role = $1, verified = true WHERE id = $2',
        ['foster', result.rows[0].user_id]
      );
    }

    res.json({
      message: `Application ${status}`,
      application: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating application:', error);
    res.status(500).json({ error: 'Failed to update application' });
  }
});

// Dashboard stats
router.get('/stats', async (req, res) => {
  try {
    const stats = await Promise.all([
      db.query('SELECT COUNT(*) as total FROM dogs'),
      db.query('SELECT COUNT(*) as urgent FROM dogs WHERE status = $1', ['urgent']),
      db.query('SELECT COUNT(*) as rescued FROM dogs WHERE status IN ($1, $2)', ['rescued', 'adopted']),
      db.query('SELECT COALESCE(SUM(amount), 0) as total FROM donations'),
      db.query('SELECT COUNT(*) as total FROM users'),
      db.query('SELECT COUNT(*) as pending FROM rescues WHERE verified = false'),
      db.query('SELECT COUNT(*) as pending FROM foster_applications WHERE status = $1', ['pending'])
    ]);

    res.json({
      dogs: {
        total: parseInt(stats[0].rows[0].total),
        urgent: parseInt(stats[1].rows[0].urgent),
        rescued: parseInt(stats[2].rows[0].rescued)
      },
      donations: {
        total: parseFloat(stats[3].rows[0].total)
      },
      users: {
        total: parseInt(stats[4].rows[0].total)
      },
      pending: {
        rescues: parseInt(stats[5].rows[0].pending),
        fosters: parseInt(stats[6].rows[0].pending)
      }
    });
  } catch (error) {
    console.error('Error fetching admin stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

module.exports = router;
