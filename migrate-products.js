const { createClient } = require("@supabase/supabase-js");
const { allProducts } = require("./scripts/products-data");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase environment variables. Create a .env.local with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function migrate() {
  console.log(`Starting migration of ${allProducts.length} products to Supabase...`);
  try {
    // Insert in batches to avoid request size limits
    const batchSize = 100;
    for (let i = 0; i < allProducts.length; i += batchSize) {
      const batch = allProducts.slice(i, i + batchSize);
      const { data, error } = await supabase.from("products").insert(batch);
      if (error) {
        console.error("Supabase insert error:", error);
        process.exit(1);
      }
      console.log(`Inserted batch ${i / batchSize + 1}: ${data?.length ?? 0} rows`);
    }
    console.log("Migration complete.");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exit(1);
  }
}

migrate();
