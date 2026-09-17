require('dotenv').config();
const app = require('./app');
const { pool } = require('./config/db');

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, async () => {
  console.log(`====================================================`);
  console.log(`🚀 Fundsroom PERN ERP Server running on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📚 Swagger API Docs: http://localhost:${PORT}/api-docs`);
  console.log(`💓 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`====================================================`);

  // Verify DB connection
  try {
    const res = await pool.query('SELECT current_database(), current_user, version()');
    console.log(`✅ Connected to PostgreSQL: DB=${res.rows[0].current_database}, User=${res.rows[0].current_user}`);
  } catch (err) {
    console.warn(`⚠️ Warning: PostgreSQL database not reachable at ${process.env.DATABASE_URL || 'localhost:5432'}.`);
    console.warn(`   Reason: ${err.message}`);
    console.warn(`   To run migrations & seeds: npm run db:setup`);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received. Closing HTTP server and database pool.');
  server.close(() => {
    pool.end();
    console.log('Server and pool closed successfully.');
    process.exit(0);
  });
});
