const { Client } = require('pg');

const databaseUrl = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/els_ecommerce_local';

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function seed() {
  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    const productsRes = await client.query('SELECT id, price FROM products LIMIT 20');
    const products = productsRes.rows;
    if (!products.length) {
      console.error('No products found to seed orders. Insert products first.');
      process.exit(1);
    }

    console.log(`Seeding 3 sample orders using ${products.length} available products...`);

    for (let i = 0; i < 3; i++) {
      // pick 1-4 distinct products
      const pickCount = randomInt(1, Math.min(4, products.length));
      const shuffled = products.sort(() => 0.5 - Math.random());
      const picked = shuffled.slice(0, pickCount);

      const items = picked.map((p) => {
        const qty = randomInt(1, 3);
        return { product_id: p.id, quantity: qty, unit_price: p.price };
      });

      const total = items.reduce((s, it) => s + Number(it.unit_price) * it.quantity, 0);

      const shipping = {
        name: `Test Customer ${i + 1}`,
        address1: `123 Test St Apt ${i + 1}`,
        city: 'Testville',
        postal_code: '00000',
        country: 'TR'
      };

      const status = i === 0 ? 'pending' : (i === 1 ? 'processing' : 'shipped');

      const orderRes = await client.query(
        'INSERT INTO orders (user_id, total, status, shipping_address, payment_method) VALUES ($1, $2, $3, $4, $5) RETURNING id',
        [null, total, status, JSON.stringify(shipping), 'card']
      );
      const orderId = orderRes.rows[0].id;

      for (const it of items) {
        await client.query(
          'INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES ($1, $2, $3, $4)',
          [orderId, it.product_id, it.quantity, it.unit_price]
        );
      }

      console.log(`Inserted order ${orderId} (${items.length} items) total ${total}`);
    }

    console.log('Order seeding complete.');
  } catch (err) {
    console.error('Failed seeding orders:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

seed();
