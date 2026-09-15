const { createClient } = require("@supabase/supabase-js");
const { allProducts } = require("./scripts/products-data");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error("Missing Supabase environment variables. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function migrate() {
  try {
    const { data: existingProducts, error: existingProductsError } = await supabase
      .from("products")
      .select("name");

    if (existingProductsError) {
      console.error("Could not read existing Supabase products:", existingProductsError);
      process.exit(1);
    }

    const existingNames = new Set((existingProducts ?? []).map((product) => product.name));
    const productsToInsert = allProducts.filter((product) => !existingNames.has(product.name));
    console.log(`Starting migration of ${productsToInsert.length} new products to Supabase...`);

    if (productsToInsert.length === 0) {
      console.log("No new products to migrate.");
      return;
    }

    // Insert in batches to avoid request size limits
    const batchSize = 100;
    for (let i = 0; i < productsToInsert.length; i += batchSize) {
      const batch = productsToInsert.slice(i, i + batchSize);
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
