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
    
    // Fix ALL varchar fields that are too small
    const migrations = [
      "ALTER TABLE dogs ALTER COLUMN name TYPE VARCHAR(255)",
      "ALTER TABLE dogs ALTER COLUMN breed TYPE VARCHAR(255)",
      "ALTER TABLE dogs ALTER COLUMN age TYPE VARCHAR(100)",
      "ALTER TABLE dogs ALTER COLUMN shelter TYPE VARCHAR(255)",
      "ALTER TABLE dogs ALTER COLUMN shelter_id TYPE VARCHAR(100)",
      "ALTER TABLE dogs ALTER COLUMN photo_url TYPE TEXT",
      "ALTER TABLE dogs ALTER COLUMN petharbor_url TYPE TEXT",
      "ALTER TABLE dogs ALTER COLUMN description TYPE TEXT"
    ];
    
    for (const migration of migrations) {
      try {
        await db.query(migration);
        console.log(`✅ Migration complete: ${migration.substring(0, 50)}...`);
      } catch (err) {
        // Ignore errors if already migrated
        if (!err.message.includes('cannot be cast')) {
          console.log(`ℹ️ Skipped: ${migration.substring(0, 50)}...`);
        }
      }
    }
    
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
    
    // Run migrations after schema
    await runMigrations();
  } catch (error) {
    console.error('❌ Database initialization error:', error);
  }
};

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/dogs', require('./routes/dogs'));
app.use('/api/donations', require('./routes/donations'));
app.use('/api/rescues', require('./routes/rescues'));
app.use('/api/fosters', require('./routes/fosters'));
app.use('/api/transport', require('./routes/transport'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api', require('./routes/fix-photos'));
app.use('/api', require('./routes/diagnose-photos'));

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
  // Start PetHarbor scraper
  const { startScraper } = require('./services/petharborScraper');
  startScraper();
  
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 LA Dog Dispatch server running on port ${PORT}`);
    console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  });
});
