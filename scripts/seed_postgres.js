const { Client } = require('pg');
const { allProducts } = require('./products-data');

const databaseUrl = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/els_ecommerce_local';

async function seed() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    await client.query('TRUNCATE TABLE products RESTART IDENTITY CASCADE');
    console.log(`Inserting ${allProducts.length} products into local Postgres...`);
    for (const p of allProducts) {
      const res = await client.query(
        `INSERT INTO products (name, brand, category, price, image_url, tag)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT DO NOTHING`,
        [p.name || null, p.brand || null, p.category || null, p.price || null, p.image_url || null, p.tag || null]
      );
    }
    console.log('Seeding complete.');
  } catch (err) {
    console.error('Seeding failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seed();
