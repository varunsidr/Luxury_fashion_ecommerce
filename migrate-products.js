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
    // Fail before any catalog edits if the required Supabase migration has not
    // been applied; otherwise the existing rows could update before inserts fail.
    const { error: schemaError } = await supabase
      .from("products")
      .select("images,sizes,color_options")
      .limit(1);

    if (schemaError) {
      if (schemaError.code === "PGRST204" || /column.*(images|sizes|color_options)/i.test(schemaError.message)) {
        console.error(
          "The demo catalog schema is missing required product columns. Apply supabase_demo_catalog_migration.sql in the Supabase SQL Editor, wait for the schema cache to refresh, then rerun this command."
        );
        process.exitCode = 1;
        return;
      }
      console.error("Could not verify the Supabase product schema:", schemaError);
      process.exitCode = 1;
      return;
    }

    const { data: existingProducts, error: existingProductsError } = await supabase
      .from("products")
      .select("id,name,category,image_url,price,images,color_options");

    if (existingProductsError) {
      console.error("Could not read existing Supabase products:", existingProductsError);
      process.exitCode = 1;
      return;
    }

    const rows = existingProducts ?? [];
    const identity = (product) => `${product.image_url}|${product.category}|${product.price}`;
    const existingByIdentity = new Map(rows.map((product) => [identity(product), product]));
    const existingNames = new Set(rows.map((product) => product.name));

    // Refresh the original demo rows' English copy without changing IDs,
    // inventory, prices, or other admin-managed fields.
    let refreshedCount = 0;
    for (const product of allProducts.slice(0, 130)) {
      const existing = existingByIdentity.get(identity(product));
      if (!existing || (existing.name === product.name && existing.category === product.category)) continue;

      const { error } = await supabase
        .from("products")
        .update({ name: product.name, category: product.category, tag: product.tag })
        .eq("id", existing.id);
      if (error) {
        console.error(`Could not update English copy for ${existing.name}:`, error);
        process.exitCode = 1;
        return;
      }
      existingNames.delete(existing.name);
      existingNames.add(product.name);
      refreshedCount += 1;
    }
    console.log(`Updated English names/categories on ${refreshedCount} existing demo products.`);

    // Older seed runs attached arbitrary category photos to invented color
    // swatches. Repair only those original demo rows on a repeat seed.
    let repairedCount = 0;
    for (const product of allProducts.filter((item) => item.image_url.startsWith("/demo-products/"))) {
      const existing = rows.find((row) => row.name === product.name && row.image_url === product.image_url);
      if (!existing) continue;
      const hasExtraImages = existing.images?.length !== 1 || existing.images[0] !== product.image_url;
      if (!hasExtraImages && !existing.color_options?.length) continue;

      const { error } = await supabase
        .from("products")
        .update({ images: [product.image_url], color_options: [] })
        .eq("id", existing.id);
      if (error) {
        console.error(`Could not repair demo images for ${product.name}:`, error);
        process.exitCode = 1;
        return;
      }
      repairedCount += 1;
    }
    console.log(`Removed incorrect color variants from ${repairedCount} demo products.`);

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
      const { data, error } = await supabase.from("products").insert(batch).select("id");
      if (error) {
        console.error("Supabase insert error:", error);
        process.exitCode = 1;
        return;
      }
      console.log(`Inserted batch ${i / batchSize + 1}: ${data?.length ?? 0} rows`);
    }
    console.log("Migration complete.");
  } catch (err) {
    console.error("Migration failed:", err);
    process.exitCode = 1;
  }
}

migrate();
