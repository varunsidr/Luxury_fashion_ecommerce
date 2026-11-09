export const demoEmail = 'demo.customer@zeouf.local';

// Auth provisioning happens separately. All application fixtures commit together
// and never alter inventory or replace real customer orders.
export async function seedAdminFixtures(client, userId) {
  await client.query('BEGIN');
  try {
    await client.query("SELECT pg_advisory_xact_lock(hashtext('zeouf-admin-fixtures'))");
    const identity = await client.query('SELECT id FROM auth.users WHERE id=$1 AND email=$2', [userId, demoEmail]);
    if (!identity.rows.length) throw new Error('Demo auth user must exist in the same database');
    const { rows: products } = await client.query('SELECT id,price FROM products ORDER BY created_at,id LIMIT 4');
    if (products.length < 4) throw new Error('Seed at least four products first');
    await client.query("INSERT INTO profiles(id,full_name) VALUES($1,'Demo Customer') ON CONFLICT(id) DO UPDATE SET full_name=excluded.full_name", [userId]);
    const statuses = ['delivered', 'processing', 'pending'];
    const groups = [[[0, 1], [1, 1]], [[2, 2]], [[3, 1]]];
    let line = 0;
    for (const [index, items] of groups.entries()) {
      const id = `a0000000-0000-4000-8000-00000000000${index + 1}`;
      const existing = await client.query('SELECT user_id,shipping_address FROM orders WHERE id=$1 FOR UPDATE', [id]);
      if (existing.rows.some(row => row.user_id !== userId || row.shipping_address?.source !== 'admin-demo-seed')) throw new Error('Fixture order ID belongs to unrelated data');
      const total = items.reduce((sum, [product, quantity]) => sum + Number(products[product].price) * quantity, 0);
      const address = { fullName: 'Demo Customer', address: '1 Demo Street', city: 'Demo City', postalCode: '00000', source: 'admin-demo-seed' };
      await client.query(`INSERT INTO orders(id,user_id,total,status,shipping_address,payment_method,placed_at)
        VALUES($1,$2,$3,$4,$5::jsonb,$6,$7) ON CONFLICT(id) DO UPDATE SET total=excluded.total,status=excluded.status,
        shipping_address=excluded.shipping_address,payment_method=excluded.payment_method`,
      [id, userId, total, statuses[index], JSON.stringify(address), index === 1 ? 'cash_on_delivery' : 'card_demo', new Date(Date.UTC(2026, 0, index + 1)).toISOString()]);
      await client.query('DELETE FROM order_items WHERE order_id=$1', [id]);
      for (const [product, quantity] of items) {
        const itemId = `b0000000-0000-4000-8000-00000000000${++line}`;
        await client.query('INSERT INTO order_items(id,order_id,product_id,quantity,unit_price) VALUES($1,$2,$3,$4,$5)', [itemId, id, products[product].id, quantity, products[product].price]);
      }
    }
    for (const [index, product] of products.entries()) {
      const id = `c0000000-0000-4000-8000-00000000000${index + 1}`;
      const existing = await client.query('SELECT user_id FROM reviews WHERE id=$1', [id]);
      if (existing.rows.some(row => row.user_id !== userId)) throw new Error('Fixture review ID belongs to unrelated data');
      await client.query(`INSERT INTO reviews(id,product_id,user_id,name,rating,title,comment,approved)
        VALUES($1,$2,$3,'Demo Customer',$4,'Fictional demo review','Illustrative feedback for this portfolio demo; not a real purchase.',true)
        ON CONFLICT(id) DO UPDATE SET product_id=excluded.product_id,name=excluded.name,rating=excluded.rating,title=excluded.title,comment=excluded.comment,approved=true`,
      [id, product.id, userId, index === 2 ? 4 : 5]);
    }
    await client.query('COMMIT');
    return { orders: groups.length, reviews: products.length };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}
