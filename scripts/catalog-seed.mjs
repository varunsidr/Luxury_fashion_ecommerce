// A direct SQL transaction keeps catalog rows, sized inventory and copy repairs
// together. Callers supply an explicit database connection; no implicit target.
export async function seedCatalog(client, products) {
  await client.query('BEGIN');
  try {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('zeouf-catalog-seed'))");
    const { rows } = await client.query('SELECT id,name,category,image_url,price,images,color_options,sizes,stock FROM products ORDER BY id FOR UPDATE');
    const identity = product => `${product.image_url}|${product.category}|${Number(product.price)}`;
    const existingByIdentity = new Map(rows.map(product => [identity(product), product]));
    const existingNames = new Set(rows.map(product => product.name));
    let inserted = 0, refreshed = 0, repaired = 0;

    for (const [index, product] of products.entries()) {
      const original = index < 130 ? existingByIdentity.get(identity(product)) : null;
      if (original && original.name !== product.name) {
        await client.query('UPDATE products SET name=$1,category=$2,tag=$3 WHERE id=$4', [product.name, product.category, product.tag ?? null, original.id]);
        existingNames.delete(original.name);
        existingNames.add(product.name);
        original.name = product.name;
        refreshed++;
      }
      const existing = rows.find(row => row.name === product.name);
      if (existing) {
        if (existing.image_url === product.image_url && existing.category === product.category) {
          if (product.image_url.startsWith('/demo-products/')) {
            await client.query('UPDATE products SET images=$1,color_options=$2::jsonb WHERE id=$3', [[product.image_url], '[]', existing.id]);
          }
          // Repair a previous split insert conservatively: absent sizes start
          // unavailable. Re-running a seed must never replenish sold stock.
          if (existing.sizes?.length) {
            const added = await client.query(`INSERT INTO product_size_stock(product_id,size,stock)
              SELECT $1,unnest($2::text[]),0 ON CONFLICT(product_id,size) DO NOTHING RETURNING size`, [existing.id, existing.sizes]);
            if (added.rows.length) {
              await client.query('UPDATE products SET stock=(SELECT coalesce(sum(stock),0) FROM product_size_stock WHERE product_id=$1 AND size=ANY($2::text[])) WHERE id=$1', [existing.id, existing.sizes]);
              repaired++;
            }
          }
        }
        continue;
      }
      if (existingNames.has(product.name)) continue;
      const sizes = product.sizes ?? [];
      const sizeRows = product.size_stock ?? [];
      if (sizeRows.some(row => !sizes.includes(row.size) || !Number.isInteger(row.stock) || row.stock < 0)
        || new Set(sizeRows.map(row => row.size)).size !== sizeRows.length) throw new Error(`Invalid seed sizes: ${product.name}`);
      const stock = sizes.length ? sizes.reduce((sum, size) => sum + (sizeRows.find(row => row.size === size)?.stock ?? 0), 0) : product.stock ?? 0;
      const { rows: created } = await client.query(`INSERT INTO products(name,category,price,image_url,images,color_options,sizes,stock,tag,brand,description)
        VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10,$11) RETURNING id`,
      [product.name, product.category, product.price, product.image_url, product.images ?? [product.image_url], JSON.stringify(product.color_options ?? []), sizes, stock, product.tag ?? null, product.brand ?? null, product.description ?? null]);
      for (const size of sizes) {
        await client.query('INSERT INTO product_size_stock(product_id,size,stock) VALUES($1,$2,$3)', [created[0].id, size, sizeRows.find(row => row.size === size)?.stock ?? 0]);
      }
      existingNames.add(product.name);
      inserted++;
    }
    await client.query('COMMIT');
    return { inserted, refreshed, repaired };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
