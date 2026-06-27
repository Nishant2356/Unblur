require('dotenv').config({ path: '../.env' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'trivia_images'")
  .then(res => {
    console.log("DB SCHEMA:");
    console.log(res.rows);
    pool.end();
  })
  .catch(console.error);
