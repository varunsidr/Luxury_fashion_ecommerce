import { inspectAdminCatalog } from './admin_security_inventory.mjs';
import pg from 'pg';

if (!process.env.DATABASE_URL) {
  process.stderr.write('DATABASE_URL is required to inspect the applied database policies.\n');
  process.exit(2);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
const findings = [];
const check = (label, passed) => findings.push({ label, passed: Boolean(passed) });

try {
  await client.connect();
  const tableNames = ['reviews', 'orders', 'order_items', 'api_rate_limits', 'checkout_attempts', 'products', 'product_size_stock'];
  const { rows: tables } = await client.query(`
    SELECT c.relname, c.relrowsecurity
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = ANY($1)
  `, [tableNames]);
  for (const name of tableNames) {
    check(`${name} has RLS`, tables.find((table) => table.relname === name)?.relrowsecurity);
  }
  const { rows: buckets } = await client.query('SELECT "public" FROM storage.buckets WHERE id = \'review-images\'');
  check('review-images bucket is private', buckets.length === 1 && buckets[0].public === false);

  const { rows: policies } = await client.query(`
    SELECT tablename, policyname, cmd, qual FROM pg_policies
    WHERE schemaname = 'public' AND tablename = ANY($1)
  `, [['reviews', 'orders', 'order_items']]);
  const reviewPolicies = policies.filter((policy) => policy.tablename === 'reviews');
  check('reviews has only the approved-or-author SELECT policy',
    reviewPolicies.length === 1 && reviewPolicies[0].cmd === 'SELECT' &&
    reviewPolicies[0].policyname === 'Approved reviews are public or authors can view own' &&
    reviewPolicies[0].qual?.includes('approved') && reviewPolicies[0].qual?.includes('uid'));
  for (const name of ['orders', 'order_items']) {
    check(`${name} has no customer INSERT policy`,
      !policies.some((policy) => policy.tablename === name && ['INSERT', 'ALL'].includes(policy.cmd)));
  }

  const { rows: grants } = await client.query(`
    SELECT
      has_any_column_privilege('anon', 'public.reviews', 'INSERT') AS anon_review_insert,
      has_any_column_privilege('authenticated', 'public.reviews', 'INSERT') AS customer_review_insert,
      has_any_column_privilege('authenticated', 'public.reviews', 'UPDATE') AS customer_review_update,
      has_table_privilege('authenticated', 'public.reviews', 'DELETE') AS customer_review_delete,
      has_table_privilege('anon', 'public.api_rate_limits', 'SELECT') AS anon_limit_read,
      has_table_privilege('authenticated', 'public.api_rate_limits', 'SELECT') AS customer_limit_read,
      has_table_privilege('anon', 'public.checkout_attempts', 'SELECT') AS anon_attempt_read,
      has_table_privilege('authenticated', 'public.checkout_attempts', 'SELECT') AS customer_attempt_read,
      has_function_privilege('authenticated', 'public.consume_api_rate_limit(text,integer,integer)', 'EXECUTE') AS customer_limit_rpc,
      has_function_privilege('service_role', 'public.consume_api_rate_limit(text,integer,integer)', 'EXECUTE') AS service_limit_rpc
  `);
  const grant = grants[0];
  for (const name of ['anon_review_insert', 'customer_review_insert', 'customer_review_update', 'customer_review_delete', 'anon_limit_read', 'customer_limit_read', 'anon_attempt_read', 'customer_attempt_read', 'customer_limit_rpc']) {
    check(`${name} denied`, grant[name] === false);
  }
  check('service_limit_rpc allowed', grant.service_limit_rpc === true);

  findings.push(...await inspectAdminCatalog(client));

  for (const result of findings) process.stdout.write(`${result.passed ? 'PASS' : 'FAIL'} ${result.label}\n`);
  if (findings.some((result) => !result.passed)) process.exitCode = 1;
} catch (error) {
  process.stderr.write(`Security database check could not complete: ${error.message}\n`);
  process.exitCode = 2;
} finally {
  await client.end().catch(() => {});
}
