const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET /api/dogs — return all dogs sorted by priority
router.get('/', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        id, name, breed, age, gender, shelter, shelter_id,
        deadline, photo_url, petharbor_url, description,
        source, category, goal_amount, raised_amount,
        rescue_only, intake_date, list_date,
        created_at
      FROM dogs
      WHERE deadline >= NOW() - INTERVAL '1 day'
      ORDER BY
        CASE shelter
          WHEN 'SOUTH L.A.' THEN 1
          WHEN 'SOUTH LA'   THEN 1
          WHEN 'WEST L.A.'  THEN 2
          WHEN 'WEST LA'    THEN 2
          WHEN 'NORTH CENTRAL' THEN 3
          WHEN 'EAST VALLEY'   THEN 4
          WHEN 'WEST VALLEY'   THEN 5
          WHEN 'HARBOR'        THEN 6
          ELSE 99
        END ASC,
        deadline ASC
    `);
    res.json({ dogs: result.rows });
  } catch (err) {
    console.error('❌ Error fetching dogs:', err.message);
    res.status(500).json({ error: 'Failed to fetch dogs' });
  }
});

// GET /api/dogs/:id — single dog
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT *, rescue_only, intake_date, list_date FROM dogs WHERE id = $1`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Dog not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch dog' });
  }
});

// POST /api/dogs/:id/fund — update raised amount
router.post('/:id/fund', async (req, res) => {
  try {
    const { amount } = req.body;
    await db.query(
      `UPDATE dogs SET raised_amount = COALESCE(raised_amount, 0) + $1 WHERE id = $2`,
      [amount, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update funding' });
  }
});

module.exports = router;
