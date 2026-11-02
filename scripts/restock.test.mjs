import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

// Isolated single-connection PostgreSQL; no mail, network, or hosted database.
const db = new PGlite();
const sized = '11111111-1111-4111-8111-111111111111';
const unsized = '22222222-2222-4222-8222-222222222222';
const migration = readFileSync(new URL('../supabase_restock_delivery_migration.sql', import.meta.url), 'utf8');
before(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,raw_user_meta_data jsonb DEFAULT '{}');
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS 'SELECT NULL::uuid';`);
  for (const path of ['supabase_schema.sql','supabase_checkout_security_migration.sql','supabase_demo_catalog_migration.sql','supabase_purchase_safeguards_migration.sql']) {
    await db.exec(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
  }
  await db.exec(migration);
});
beforeEach(async () => {
  await db.exec('TRUNCATE public.products CASCADE');
  await db.query(`INSERT INTO products(id,name,category,price,stock,sizes,image_url,color_options) VALUES
    ($1,'Sized','Women''s Dress',1000,0,ARRAY['S','M'],'/kadin-product-1.jpg','[{"name":"Brown"}]'),
    ($2,'Bag','Bags',500,0,'{}','/canta-5.jpg','[]')`, [sized,unsized]);
  await db.query("INSERT INTO product_size_stock(product_id,size,stock) VALUES($1,'S',0),($1,'M',0)", [sized]);
});
after(() => db.close());
async function subscribe(id = sized, size = 'S', color = null, email = 'fixture@example.invalid') {
  return (await db.query('SELECT subscribe_restock($1,$2,$3,$4,$5) AS result', [id,email,size,color,randomBytes(32).toString('hex')])).rows[0].result;
}
async function stock(id, size, value) { await db.query('SELECT set_product_stock($1,$2,$3)', [id,size,value]); }
async function claim(id = null) { return (await db.query('SELECT claim_restock_notifications($1,10) AS request', [id])).rows.map(r => r.request); }
async function finish(n, success = true, retryable = true) {
  return (await db.query('SELECT finish_restock_delivery($1,$2,$3,$4,$5) AS result', [n.id,n.claim_token,success,'FIXTURE_FAILURE',retryable])).rows[0].result;
}
async function prepare(n, payload) {
  return (await db.query('SELECT prepare_restock_delivery($1,$2,$3::jsonb) AS payload', [n.id,n.claim_token,JSON.stringify(payload)])).rows[0].payload;
}

test('subscription validates actual options and availability, normalizes email and deduplicates exact pending variants', async () => {
  assert.equal(await subscribe(sized,'S','Brown',' Fixture@Example.invalid '), 'subscribed');
  assert.equal(await subscribe(sized,'S','Brown'), 'already_subscribed');
  assert.equal(await subscribe(sized,'M','Brown'), 'subscribed');
  assert.equal(await subscribe(sized,'S',null,'fixture_%@example.invalid'), 'subscribed');
  assert.equal(await subscribe(sized,'S',null,'fixture_1@example.invalid'), 'subscribed');
  await assert.rejects(subscribe(sized,'XL'), /INVALID_OPTION/);
  await assert.rejects(subscribe(unsized,'S'), /INVALID_OPTION/);
  await assert.rejects(subscribe(sized,'S','Blue'), /INVALID_OPTION/);
  await assert.rejects(subscribe(sized,'S',null,'bad'), /INVALID_REQUEST/);
  await assert.rejects(subscribe(randomUUID()), /PRODUCT_NOT_FOUND/);
  await stock(sized,'M',2);
  await assert.rejects(subscribe(sized,'M'), /ALREADY_AVAILABLE/);
  await assert.rejects(subscribe(sized,null), /ALREADY_AVAILABLE/);
  assert.equal(await subscribe(sized,'S'), 'subscribed');
});

test('only genuine configured zero-to-positive changes queue alerts, with whole-product and exact-size eligibility', async () => {
  await subscribe(sized,'S'); await subscribe(sized,'M'); await subscribe(sized,null);
  await db.query("INSERT INTO product_size_stock(product_id,size,stock) VALUES($1,'Retired',5)", [sized]);
  assert.equal((await claim()).length,0);
  await stock(sized,'S',0);
  assert.equal((await claim()).length,0);
  await stock(sized,'M',1);
  const first = await claim();
  assert.deepEqual(first.map(n => n.size).sort(), ['M',null].sort());
  for (const n of first) await finish(n);
  await stock(sized,'M',2);
  assert.equal((await claim()).length,0);
  await stock(sized,'S',1);
  assert.deepEqual((await claim()).map(n => n.size), ['S']);
});

test('legacy positive-stock requests do not send on repeated positive saves, and unsized alerts require a transition', async () => {
  await stock(unsized,null,2);
  await db.query("INSERT INTO restock_notifications(product_id,email,unsubscribe_token) VALUES($1,'legacy@example.invalid',$2)", [unsized,randomBytes(32).toString('hex')]);
  await stock(unsized,null,3);
  assert.equal((await claim()).length,0);
  await stock(unsized,null,0); await stock(unsized,null,1);
  assert.equal((await claim()).length,1);
});

test('claim and prepare both recheck live inventory and removed options, and unsubscribe cancels an unsent claim', async () => {
  await subscribe(); await stock(sized,'S',1); await stock(sized,'S',0);
  assert.equal((await claim()).length,0);
  await stock(sized,'S',1);
  const [n] = await claim();
  await stock(sized,'S',0);
  assert.equal(await prepare(n,{ subject: 'fixture' }),null);
  await stock(sized,'S',1);
  await db.query('DELETE FROM restock_notifications WHERE id=$1', [n.id]);
  assert.equal(await prepare(n,{ subject: 'fixture' }),null);
  assert.equal(await finish(n),false);
  await stock(sized,'S',0); await subscribe(); await stock(sized,'S',1);
  await db.query("UPDATE products SET sizes=ARRAY['M'] WHERE id=$1", [sized]);
  assert.equal((await claim()).length,0);
});

test('due batches drain more than 100 requests without the wrong-size requests consuming the limit', async () => {
  for (let i=0;i<105;i++) await subscribe(sized,'M',null,`m${i}@example.invalid`);
  for (let i=0;i<15;i++) await subscribe(sized,'S',null,`s${i}@example.invalid`);
  await stock(sized,'S',2);
  let count = 0;
  for (;;) {
    const batch = await claim(); if (!batch.length) break;
    assert.ok(batch.length <= 10);
    assert.ok(batch.every(n => n.size === 'S'));
    count += batch.length;
    for (const n of batch) await finish(n);
  }
  assert.equal(count,15);
  await stock(sized,'M',1);
  for (;;) {
    const batch = await claim(); if (!batch.length) break;
    count += batch.length;
    for (const n of batch) await finish(n);
  }
  assert.equal(count,120);
});

test('leases prevent overlapping claims, recover crashes and reject a stale worker completion', async () => {
  await subscribe(); await stock(sized,'S',1);
  const [first] = await claim(); assert.equal((await claim()).length,0);
  await db.query("UPDATE restock_notifications SET claimed_at=now()-interval '11 minutes' WHERE id=$1", [first.id]);
  const [second] = await claim();
  assert.notEqual(first.claim_token,second.claim_token);
  assert.equal(second.attempt_count,2);
  assert.equal(await finish(first),false);
  assert.equal(await finish(second),true);
  assert.equal((await claim()).length,0);
});

test('retries back off, freeze the payload and park permanent or expired ambiguous attempts', async () => {
  await subscribe(); await stock(sized,'S',1);
  const [first] = await claim();
  const payload = { to: ['fixture@example.invalid'], subject: 'Original' };
  assert.deepEqual(await prepare(first,payload),payload);
  await finish(first,false);
  assert.equal((await claim()).length,0);
  let row = (await db.query('SELECT * FROM restock_notifications WHERE id=$1', [first.id])).rows[0];
  assert.equal(row.notified_at,null); assert.equal(row.last_error,'FIXTURE_FAILURE');
  await db.query("UPDATE restock_notifications SET next_attempt_at=now()-interval '1 minute' WHERE id=$1", [first.id]);
  const [retry] = await claim();
  assert.deepEqual(await prepare(retry,{ subject: 'Changed' }),payload);
  await finish(retry,false,false);
  row = (await db.query('SELECT * FROM restock_notifications WHERE id=$1', [first.id])).rows[0];
  assert.equal(row.needs_review,true); assert.equal((await claim()).length,0);
  await db.query("UPDATE restock_notifications SET needs_review=false, next_attempt_at=now()-interval '1 minute', first_attempt_at=now()-interval '23 hours' WHERE id=$1", [first.id]);
  assert.equal((await claim()).length,0);
  row = (await db.query('SELECT * FROM restock_notifications WHERE id=$1', [first.id])).rows[0];
  assert.equal(row.needs_review,true); assert.equal(row.last_error,'RETRY_WINDOW_EXPIRED');
});

test('restock RPCs are service-only and migration reapply preserves queued requests', async () => {
  await subscribe(); await stock(sized,'S',1);
  const before = (await db.query('SELECT * FROM restock_notifications')).rows;
  await db.exec(migration);
  assert.deepEqual((await db.query('SELECT * FROM restock_notifications')).rows,before);
  for (const signature of ['subscribe_restock(uuid,text,text,text,text)','restock_option_available(uuid,text,text)',
    'claim_restock_notifications(uuid,integer)','prepare_restock_delivery(uuid,uuid,jsonb)','finish_restock_delivery(uuid,uuid,boolean,text,boolean)']) {
    const row = (await db.query("SELECT has_function_privilege('anon',$1,'EXECUTE') AS anon, has_function_privilege('authenticated',$1,'EXECUTE') AS customer, has_function_privilege('service_role',$1,'EXECUTE') AS service", [signature])).rows[0];
    assert.deepEqual(row,{ anon: false, customer: false, service: true });
  }
});
