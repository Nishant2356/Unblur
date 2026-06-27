require('dotenv').config({ path: '../.env' });
const { Pool } = require('pg');
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function check() {
  // Check actual column types
  const schema = await pool.query(
    "SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name = 'trivia_images'"
  );
  console.log("SCHEMA:", schema.rows);

  // Check a pokemon row
  const pokemon = await pool.query("SELECT id, answer, aliases FROM trivia_images WHERE category = 'pokemon' LIMIT 2");
  console.log("POKEMON ROWS:", JSON.stringify(pokemon.rows, null, 2));

  // Check pg_typeof
  const typeCheck = await pool.query("SELECT pg_typeof(aliases) as type FROM trivia_images LIMIT 1");
  console.log("PG_TYPEOF:", typeCheck.rows);

  pool.end();
}
check();
