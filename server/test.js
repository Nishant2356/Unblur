require('dotenv').config({ path: '../.env' });
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_EcFTDtr4S8sI@ep-fragrant-meadow-aohdacvd-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
  ssl: { rejectUnauthorized: false }
});

pool.query("SELECT * FROM trivia_images WHERE category = 'pokemon'")
  .then(res => console.log('Rows:', res.rows.length))
  .catch(err => console.error('Error:', err.message))
  .finally(() => pool.end());
