const express = require('express');
const router = express.Router();
const db = require('../config/database');

// ── GET /api/rescue-directory/match?breed=Pit+Bull ──────────────────
// Returns breed-matched rescues first, then general ones
router.get('/match', async (req, res) => {
  try {
    const breed = (req.query.breed || '').toLowerCase().trim();

    // Ensure table exists
    await db.query(`
      CREATE TABLE IF NOT EXISTS rescue_directory (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255),
        ig_handle VARCHAR(100),
        breed_specific TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    const result = await db.query(
      'SELECT name, ig_handle, breed_specific FROM rescue_directory ORDER BY name'
    );

    const all = result.rows;

    if (!breed) {
      // No breed — return only general rescues
      const general = all.filter(r => !r.breed_specific || r.breed_specific.trim() === '');
      return res.json({ breed_specific: [], general });
    }

    // Split breed into keywords for fuzzy matching
    const breedKeywords = breed.split(/[\s\/\-,]+/).filter(w => w.length > 2);

    const breedSpecific = [];
    const general = [];

    for (const rescue of all) {
      const bs = (rescue.breed_specific || '').toLowerCase();
      if (!bs) {
        general.push(rescue);
        continue;
      }

      // Match if any breed keyword appears in the breed_specific field
      const isMatch = breedKeywords.some(kw => bs.includes(kw)) ||
        bs.includes('all breeds') ||
        bs.includes('all dogs');

      if (isMatch && !bs.includes('all breeds') && !bs.includes('all dogs')) {
        breedSpecific.push(rescue);
      } else if (bs.includes('all breeds') || bs.includes('all dogs')) {
        // "all breeds" go in general bucket
        general.push(rescue);
      }
      // Breed-specific that don't match are excluded entirely
    }

    res.json({ breed_specific: breedSpecific, general });
  } catch (err) {
    console.error('❌ Rescue directory error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/rescue-directory/seed ─────────────────────────────────
// Seeds the rescue directory from the hardcoded data
router.post('/seed', async (req, res) => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS rescue_directory (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255),
        ig_handle VARCHAR(100),
        breed_specific TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);

    const rescues = require('../data/rescue_directory.json');
    
    await db.query('DELETE FROM rescue_directory');
    
    for (const r of rescues) {
      await db.query(
        'INSERT INTO rescue_directory (name, ig_handle, breed_specific) VALUES ($1, $2, $3)',
        [r.name, r.ig_handle, r.breed_specific || '']
      );
    }

    res.json({ success: true, count: rescues.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/rescue-directory ────────────────────────────────────────
// Returns all rescues
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT name, ig_handle, breed_specific FROM rescue_directory ORDER BY name'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
