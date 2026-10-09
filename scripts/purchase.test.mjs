import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

// Real PostgreSQL in memory, with no URL, network, or shared database cleanup.
// Single connection: this does not establish multi-session concurrency safety.
const db = new PGlite();
const user = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const otherUser = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const sized = '11111111-1111-4111-8111-111111111111';
const unsized = '22222222-2222-4222-8222-222222222222';
const demo = '33333333-3333-4333-8333-333333333333';
const address = { fullName: 'Fictional Tester', phone: '000', address: 'Demo', city: 'Demo', postalCode: '000' };

before(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY, email text, raw_user_meta_data jsonb DEFAULT '{}');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS 'SELECT NULL::uuid';`);
  for (const path of ['supabase_schema.sql', 'supabase_checkout_security_migration.sql', 'supabase_demo_catalog_migration.sql', 'supabase_purchase_safeguards_migration.sql']) {
    await db.exec(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
  }
});
beforeEach(async () => {
  await db.exec('TRUNCATE auth.users, public.products CASCADE');
  await db.query('INSERT INTO auth.users(id) VALUES($1),($2)', [user, otherUser]);
  await db.query(`INSERT INTO products(id,name,category,price,stock,sizes,image_url,color_options) VALUES
    ($1,'Sized','Women''s Dress',2500,3,ARRAY['S','M'],'/kadin-product-1.jpg','[{"name":"Brown"},{"name":"Black"}]'),
    ($2,'Unsized','Bags',999.50,1,'{}','/canta-5.jpg','[]'),
    ($3,'Demo','Women''s Dress',1000,2,ARRAY['M'],'/demo-products/womens-dress/01.jpg','[{"name":"Invented"}]')`, [sized, unsized, demo]);
  await db.query(`INSERT INTO product_size_stock(product_id,size,stock) VALUES($1,'S',0),($1,'M',3),($2,'M',2)`, [sized, demo]);
});
after(() => db.close());

async function checkout(items, key = randomUUID(), customer = user, shipping = address, payment = 'card_demo') {
  const { rows } = await db.query('SELECT create_checkout_order($1,$2::jsonb,$3::jsonb,$4,$5) AS result', [customer, JSON.stringify(items), JSON.stringify(shipping), payment, key]);
  return rows[0].result;
}
async function stock(id, size, value) {
  const { rows } = await db.query('SELECT set_product_stock($1,$2,$3) AS stock', [id, size, value]);
  return rows[0].stock;
}
async function state() {
  return (await db.query(`SELECT
    (SELECT count(*)::int FROM orders) AS orders,
    (SELECT count(*)::int FROM order_items) AS lines,
    (SELECT count(*)::int FROM checkout_attempts) AS attempts,
    (SELECT jsonb_agg(jsonb_build_array(id,stock) ORDER BY id) FROM products) AS products,
    (SELECT jsonb_agg(jsonb_build_array(product_id,size,stock) ORDER BY product_id,size) FROM product_size_stock) AS sizes`)).rows[0];
}

test('identical replay returns the original order even after the last unit is gone', async () => {
  const key = randomUUID();
  const items = [{ id: unsized, quantity: 1, size: null, color: null, price: 1 }];
  const first = await checkout(items, key);
  assert.equal(Number(first.total), 999.5);
  const saved = await state();
  assert.deepEqual(await checkout(items, key), first);
  assert.deepEqual(await state(), saved);
  assert.equal(saved.orders, 1);
  assert.equal(saved.attempts, 1);
});
test('reusing a key with changed items, address or payment rejects without side effects', async () => {
  const key = randomUUID();
  const items = [{ id: sized, quantity: 1, size: 'M', color: 'Brown' }];
  await checkout(items, key);
  const saved = await state();
  await assert.rejects(checkout([{ ...items[0], quantity: 2 }], key), /IDEMPOTENCY_CONFLICT/);
  await assert.rejects(checkout(items, key, user, { ...address, city: 'Changed' }), /IDEMPOTENCY_CONFLICT/);
  await assert.rejects(checkout(items, key, user, address, 'cash_on_delivery'), /IDEMPOTENCY_CONFLICT/);
  assert.deepEqual(await state(), saved);
});
test('attempt keys are scoped to the authenticated customer', async () => {
  const key = randomUUID();
  const items = [{ id: sized, quantity: 1, size: 'M', color: 'Brown' }];
  const first = await checkout(items, key);
  const second = await checkout(items, key, otherUser);
  assert.notEqual(first.order_id, second.order_id);
  assert.equal((await state()).orders, 2);
});
test('missing and invented size/color choices fail and roll back the full transaction', async () => {
  const saved = await state();
  for (const item of [
    { id: sized, quantity: 1 }, { id: sized, quantity: 1, size: 'XXL', color: 'Brown' },
    { id: sized, quantity: 1, size: 'M', color: 'Purple' }, { id: sized, quantity: 1, size: 'M' },
    { id: unsized, quantity: 1, size: 'M' }, { id: unsized, quantity: 1, color: 'Black' },
    { id: demo, quantity: 1, size: 'M', color: 'Invented' },
  ]) {
    await assert.rejects(checkout([item]), /INVALID_OPTION/);
    assert.deepEqual(await state(), saved);
  }
});
test('sized orders snapshot options and share stock across colors, preserving aggregate', async () => {
  const order = await checkout([{ id: sized, quantity: 1, size: 'M', color: 'Brown' }, { id: sized, quantity: 2, size: 'M', color: 'Black' }]);
  assert.equal(Number(order.total), 7500);
  assert.equal(Number((await db.query('SELECT stock FROM products WHERE id=$1', [sized])).rows[0].stock), 0);
  assert.deepEqual((await db.query('SELECT size,color,quantity FROM order_items ORDER BY quantity')).rows,
    [{ size: 'M', color: 'Brown', quantity: 1 }, { size: 'M', color: 'Black', quantity: 2 }]);
  await assert.rejects(checkout([{ id: sized, quantity: 1, size: 'M', color: 'Brown' }]), /OUT_OF_STOCK/);
});
test('a later-line failure leaves no order, attempt, or earlier stock decrement', async () => {
  const saved = await state();
  await assert.rejects(checkout([{ id: unsized, quantity: 1 }, { id: sized, quantity: 1, size: 'S', color: 'Brown' }]), /OUT_OF_STOCK/);
  assert.deepEqual(await state(), saved);
});
test('missing stock rows fail closed and size edits atomically recalculate configured stock', async () => {
  await db.query('DELETE FROM product_size_stock WHERE product_id=$1 AND size=$2', [sized, 'M']);
  await assert.rejects(checkout([{ id: sized, quantity: 1, size: 'M', color: 'Brown' }]), /OUT_OF_STOCK/);
  assert.equal(await stock(sized, 'M', 4), 4);
  assert.equal(await stock(sized, 'S', 2), 6);
  const saved = await state();
  await assert.rejects(stock(sized, 'XXL', 9), /INVALID_OPTION/);
  await assert.rejects(stock(sized, null, 9), /INVALID_OPTION/);
  await assert.rejects(stock(unsized, 'M', 9), /INVALID_OPTION/);
  await assert.rejects(stock(unsized, null, -1), /INVALID_STOCK/);
  await assert.rejects(stock(randomUUID(), null, 2), /PRODUCT_NOT_FOUND/);
  assert.deepEqual(await state(), saved);
  assert.equal(await stock(unsized, null, 2), 2);
});
test('obsolete size rows cannot inflate aggregate stock', async () => {
  await db.query('INSERT INTO product_size_stock(product_id,size,stock) VALUES($1,$2,100)', [sized, 'Removed']);
  assert.equal(await stock(sized, 'M', 4), 4);
  await checkout([{ id: sized, quantity: 1, size: 'M', color: 'Black' }]);
  assert.equal((await db.query('SELECT stock FROM products WHERE id=$1', [sized])).rows[0].stock, 3);
});
test('customer roles cannot invoke purchase/stock RPCs or read private attempts; old RPC is removed', async () => {
  assert.equal((await db.query("SELECT to_regprocedure('public.create_checkout_order(uuid,jsonb,jsonb,text)') AS old")).rows[0].old, null);
  for (const role of ['anon', 'authenticated']) {
    await db.exec(`SET ROLE ${role}`);
    try {
      await assert.rejects(checkout([{ id: unsized, quantity: 1 }]), /permission denied/);
      await assert.rejects(stock(unsized, null, 2), /permission denied/);
      await assert.rejects(db.query('SELECT * FROM checkout_attempts'), /permission denied/);
    } finally { await db.exec('RESET ROLE'); }
  }
});
test('staging product-option setup preserves IDs and provides mixed and zero-stock fixtures', async () => {
  const fixtures = ['44444444-4444-4444-8444-444444444444', '55555555-5555-4555-8555-555555555555', '66666666-6666-4666-8666-666666666666'];
  for (const [index, image] of ['/kadin-bluz-1.jpg', '/demo-products/womens-dress/01.jpg', '/demo-products/womens-dress/05.jpg'].entries()) {
    await db.query('INSERT INTO products(id,name,price,image_url) VALUES($1,$2,1000,$3)', [fixtures[index], `Fixture ${index}`, image]);
  }
  await db.exec(readFileSync(new URL('./staging_product_options.sql', import.meta.url), 'utf8'));
  const rows = (await db.query('SELECT id,sizes,stock FROM products WHERE id=ANY($1::uuid[]) ORDER BY id', [fixtures])).rows;
  assert.deepEqual(rows.map((row) => row.id), fixtures);
  assert.deepEqual(rows.map((row) => row.stock), [9, 6, 0]);
  assert.ok(rows.every((row) => row.sizes.join(',') === 'S,M,L'));
});
