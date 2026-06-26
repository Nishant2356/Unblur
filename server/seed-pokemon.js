require('dotenv').config({ path: '../.env' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function seed() {
  try {
    console.log("Fetching first 151 Pokemon...");
    // Using Node native fetch (Node 18+)
    const res = await fetch("https://pokeapi.co/api/v2/pokemon?limit=151");
    const data = await res.json();
    
    console.log("Ensuring trivia_images table exists...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS trivia_images (
        id SERIAL PRIMARY KEY,
        url TEXT NOT NULL,
        answer TEXT NOT NULL,
        aliases TEXT[] NOT NULL,
        category TEXT NOT NULL
      )
    `);

    // Optionally, clear existing pokemon if user runs this multiple times
    await pool.query("DELETE FROM trivia_images WHERE category = 'pokemon'");

    console.log("Inserting Pokemon into database...");
    let inserted = 0;
    for (let i = 0; i < data.results.length; i++) {
      const p = data.results[i];
      const id = i + 1;
      const url = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
      const rawName = p.name;
      
      // Capitalize first letter
      const answer = rawName.charAt(0).toUpperCase() + rawName.slice(1);
      
      // Aliases (e.g. mr-mime -> mr mime)
      const aliases = [rawName, rawName.replace('-', ' '), rawName.replace('-', '')];

      await pool.query(
        'INSERT INTO trivia_images (url, answer, aliases, category) VALUES ($1, $2, $3, $4)',
        [url, answer, aliases, 'pokemon']
      );
      inserted++;
      if (inserted % 25 === 0) console.log(`Inserted ${inserted}...`);
    }
    console.log(`Success! Inserted ${inserted} Pokemon.`);
  } catch (err) {
    console.error("Error seeding:", err);
  } finally {
    pool.end();
  }
}

seed();
