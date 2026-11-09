const { Client } = require("pg");
const { allProducts } = require("./products-data");

async function seed() {
  const { seedCatalog } = await import("./catalog-seed.mjs");
  const client = new Client({ connectionString: process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/els_ecommerce_local" });
  await client.connect();
  try {
    const result = await seedCatalog(client, allProducts);
    console.log(`Catalog seed committed: ${result.inserted} products inserted. Existing products, orders and customer data are retained.`);
  } finally { await client.end(); }
}

seed().catch(() => {
  console.error("Catalog seed failed. Verify connectivity and current catalog migrations; no seed changes were committed.");
  process.exitCode = 1;
});
