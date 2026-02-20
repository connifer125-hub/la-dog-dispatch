const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Database connection
const db = require('./config/database');

// Run migrations to fix ALL field lengths
const runMigrations = async () => {
  try {
    console.log('🔧 Running database migrations...');
    
    const migrations = [
      "ALTER TABLE dogs ALTER COLUMN name TYPE VARCHAR(255)",
      "ALTER TABLE dogs ALTER COLUMN breed TYPE VARCHAR(255)",
      "ALTER TABLE dogs ALTER COLUMN age TYPE VARCHAR(100)",
      "ALTER TABLE dogs ALTER COLUMN shelter TYPE VARCHAR(255)",
      "ALTER TABLE dogs ALTER COLUMN shelter_id TYPE VARCHAR(100)",
      "ALTER TABLE dogs ALTER COLUMN photo_url TYPE TEXT",
      "ALTER TABLE dogs ALTER COLUMN petharbor_url TYPE TEXT",
      "ALTER TABLE dogs ALTER COLUMN description TYPE TEXT",
      "ALTER TABLE dogs ADD COLUMN IF NOT EXISTS shelter_priority INTEGER DEFAULT 99",
      "ALTER TABLE dogs ADD COLUMN IF NOT EXISTS rescue_only BOOLEAN DEFAULT FALSE",
      "ALTER TABLE dogs ADD COLUMN IF NOT EXISTS intake_date DATE",
      "ALTER TABLE dogs ADD COLUMN IF NOT EXISTS list_date DATE"
    ];
    
    for (const migration of migrations) {
      try {
        await db.query(migration);
        console.log(`✅ Migration complete: ${migration.substring(0, 50)}...`);
      } catch (err) {
        if (!err.message.includes('cannot be cast')) {
          console.log(`ℹ️ Skipped: ${migration.substring(0, 50)}...`);
        }
      }
    }
    await db.query("UPDATE dogs SET shelter_priority = 1 WHERE shelter ILIKE '%SOUTH L.A%' OR shelter ILIKE '%SOUTH LA%'");
    await db.query("UPDATE dogs SET shelter_priority = 2 WHERE shelter ILIKE '%WEST L.A%' OR shelter ILIKE '%WEST LA%'");
    await db.query("UPDATE dogs SET shelter_priority = 3 WHERE shelter ILIKE '%NORTH CENTRAL%'");
    await db.query("UPDATE dogs SET shelter_priority = 4 WHERE shelter ILIKE '%EAST VALLEY%'");
    await db.query("UPDATE dogs SET shelter_priority = 5 WHERE shelter ILIKE '%WEST VALLEY%'");
    await db.query("UPDATE dogs SET shelter_priority = 6 WHERE shelter ILIKE '%HARBOR%'");
    console.log('✅ Updated shelter priorities');
    console.log('✅ All migrations complete!');
    
  } catch (error) {
    console.error('❌ Migration error:', error.message);
  }
};

// Initialize database tables
const initDB = async () => {
  try {
    const fs = require('fs');
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await db.query(schema);
    console.log('✅ Database tables initialized');
    await runMigrations();
  } catch (error) {
    console.error('❌ Database initialization error:', error);
  }
};

// ── ACTIVE ROUTES ──
app.use('/api/dogs', require('./routes/dogs'));
app.use('/api', require('./routes/fix-photos'));
app.use('/api', require('./routes/diagnose-photos'));

// Force migration endpoint - adds new columns if they don't exist
app.get('/api/run-migrations', async (req, res) => {
  try {
    await db.query("ALTER TABLE dogs ADD COLUMN IF NOT EXISTS rescue_only BOOLEAN DEFAULT FALSE");
    await db.query("ALTER TABLE dogs ADD COLUMN IF NOT EXISTS intake_date DATE");
    await db.query("ALTER TABLE dogs ADD COLUMN IF NOT EXISTS list_date DATE");
    res.json({ message: 'Migrations complete - columns added' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Manual scraper trigger (for testing/refreshing data)
app.get('/api/scrape-now', async (req, res) => {
  try {
    const { scrapePetHarbor } = require('./services/petharborScraper');
    res.json({ message: 'Scrape started' });
    scrapePetHarbor();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── ROUTES NOT YET BUILT (uncomment as each page is built) ──
// app.use('/api/auth', require('./routes/auth'));
// app.use('/api/donations', require('./routes/donations'));
app.use('/api/rescues', require('./routes/rescues'));
app.use('/api/fosters', require('./routes/fosters'));


// Subscribers (newsletter sign-ups)
app.post('/api/subscribers', async (req, res) => {
  try {
    const { name, email, phone, dog_alerts, newsletter, text_ok } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required' });
    await db.query(`CREATE TABLE IF NOT EXISTS subscribers (
      id SERIAL PRIMARY KEY, name VARCHAR(200), email VARCHAR(255) UNIQUE,
      phone VARCHAR(50), dog_alerts BOOLEAN, newsletter BOOLEAN, text_ok BOOLEAN,
      instagram_handle VARCHAR(100), is_sharer BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW())`);
    await db.query(`ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS instagram_handle VARCHAR(100)`).catch(()=>{});
    await db.query(`ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS is_sharer BOOLEAN DEFAULT FALSE`).catch(()=>{});
    const { instagram_handle, is_sharer } = req.body;
    await db.query(
      `INSERT INTO subscribers (name, email, phone, dog_alerts, newsletter, text_ok, instagram_handle, is_sharer)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (email) DO UPDATE 
       SET name=$1, phone=$3, dog_alerts=$4, newsletter=$5, text_ok=$6, instagram_handle=$7, is_sharer=$8`,
      [name, email, phone, dog_alerts, newsletter, text_ok, instagram_handle || null, is_sharer || false]
    );
    console.log('📧 New subscriber:', email);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Transporters sign-ups
app.post('/api/transporters', async (req, res) => {
  try {
    const { first_name, last_name, email, phone, city, zip, range, contact_pref } = req.body;
    if (!email || !first_name) return res.status(400).json({ error: 'Name and email required' });
    await db.query(`CREATE TABLE IF NOT EXISTS transporters (
      id SERIAL PRIMARY KEY, first_name VARCHAR(100), last_name VARCHAR(100),
      email VARCHAR(255), phone VARCHAR(50), city VARCHAR(100), zip VARCHAR(20),
      range VARCHAR(50), contact_pref VARCHAR(100), created_at TIMESTAMP DEFAULT NOW())`);
    await db.query(
      `INSERT INTO transporters (first_name, last_name, email, phone, city, zip, range, contact_pref)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [first_name, last_name, email, phone, city, zip, range, contact_pref]
    );
    console.log('🚗 New transporter:', first_name, email);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
// app.use('/api/transport', require('./routes/transport'));
// app.use('/api/admin', require('./routes/admin'));
// app.use('/api/notifications', require('./routes/notifications'));

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Initialize DB and start server
initDB().then(() => {
  const { startScraper } = require('./services/petharborScraper');
  startScraper();
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 LA Dog Dispatch server running on port ${PORT}`);
    console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
});
