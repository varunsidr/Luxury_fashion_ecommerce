const { Client } = require("pg");
const { allProducts } = require("./scripts/products-data");

async function migrate() {
  if (!process.env.DATABASE_URL) throw new Error("Set DATABASE_URL explicitly in .env.local for the intended migrated database. No implicit database target is used.");
  const { seedCatalog } = await import("./scripts/catalog-seed.mjs");
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const result = await seedCatalog(client, allProducts);
    console.log(`Catalog seed committed: ${result.inserted} new products, ${result.refreshed} copy updates, ${result.repaired} incomplete sized products repaired at zero stock.`);
  } finally {
    await client.end();
  }
}

migrate().catch(() => {
  console.error("Catalog seed failed; no seed changes were committed. Verify DATABASE_URL, connectivity and current catalog migrations. Credentials and database error details are omitted.");
  process.exitCode = 1;
});
