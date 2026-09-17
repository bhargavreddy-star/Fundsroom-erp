const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

const poolConfig = connectionString
  ? {
      connectionString,
      ssl: process.env.DATABASE_SSL === 'true' || connectionString.includes('neon.tech') || connectionString.includes('supabase.co')
        ? { rejectUnauthorized: false }
        : false,
    }
  : {
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || 'postgres',
      host: process.env.PGHOST || 'localhost',
      port: parseInt(process.env.PGPORT || '5432', 10),
      database: process.env.PGDATABASE || 'erp_db',
    };

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  console.error('[Database Pool Error]:', err.message);
});

/**
 * Execute a single query against the database pool
 * @param {string} text - SQL statement
 * @param {Array} params - Parameter array
 */
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV === 'development' && process.env.DEBUG_SQL === 'true') {
      console.log('[SQL]', { text, params, duration, rows: res.rowCount });
    }
    return res;
  } catch (err) {
    console.error('[SQL Error]', { text, params, error: err.message });
    throw err;
  }
};

/**
 * Get a dedicated client from the pool for transactions
 * @returns {Promise<import('pg').PoolClient>}
 */
const getClient = async () => {
  const client = await pool.connect();
  return client;
};

module.exports = {
  pool,
  query,
  getClient,
};
