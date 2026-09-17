const { Client } = require('pg');
require('dotenv').config();
const runMigrations = require('./migrate');
const runSeeds = require('./seed');
const { pool } = require('../config/db');

const ensureDatabaseExists = async () => {
  const dbName = process.env.PGDATABASE || 'erp_db';
  const connectionString = process.env.DATABASE_URL;

  // If using a cloud database URL like Supabase/Neon, database is already provisioned
  if (connectionString && (connectionString.includes('neon.tech') || connectionString.includes('supabase.co'))) {
    console.log(`ℹ️ Cloud database detected. Skipping CREATE DATABASE step.`);
    return;
  }

  // Connect to default 'postgres' database to check/create target database
  const clientConfig = {
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD || 'postgres',
    host: process.env.PGHOST || 'localhost',
    port: parseInt(process.env.PGPORT || '5432', 10),
    database: 'postgres',
  };

  const client = new Client(clientConfig);
  try {
    await client.connect();
    const res = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
    if (res.rows.length === 0) {
      console.log(`Database '${dbName}' does not exist. Creating database...`);
      await client.query(`CREATE DATABASE "${dbName}"`);
      console.log(`✅ Database '${dbName}' created successfully.`);
    } else {
      console.log(`ℹ️ Database '${dbName}' already exists.`);
    }
  } catch (err) {
    console.warn(`⚠️ Note while checking database creation: ${err.message}`);
  } finally {
    await client.end();
  }
};

const setup = async () => {
  try {
    console.log('🚀 Setting up PERN ERP Database...');
    await ensureDatabaseExists();
    await runMigrations();
    await runSeeds();
    console.log('🎉 Full Database Setup Finished Successfully!');
  } catch (err) {
    console.error('❌ Setup failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
};

setup();
