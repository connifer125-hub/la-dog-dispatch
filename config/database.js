const { Pool } = require('pg');

// Railway automatically provides DATABASE_URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,

  // ── CONNECTION POOL LIMITS ──
  max: 5,                      // max 5 simultaneous connections (Railway free tier safe)
  min: 1,                      // keep 1 connection alive at all times
  idleTimeoutMillis: 30000,    // release idle connections after 30s
  connectionTimeoutMillis: 5000, // fail fast if can't get a connection in 5s
  acquireTimeoutMillis: 8000,  // fail fast if pool is full and can't acquire in 8s
});

pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected database error:', err);
  // Don't crash the server on pool errors — log and continue
});

pool.on('remove', () => {
  console.log('🔌 DB connection removed from pool');
});

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool
};
