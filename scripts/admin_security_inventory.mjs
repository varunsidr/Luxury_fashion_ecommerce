// Read-only queries shared by the live inspector and isolated PostgreSQL tests.
export async function inspectAdminCatalog(client) {
  const findings = [];
  const check = (label, passed) => findings.push({ label, passed: Boolean(passed) });
  const { rows: [legacy] } = await client.query("SELECT to_regprocedure('public.create_checkout_order(uuid,jsonb,jsonb,text)') IS NULL AS removed");
  check('legacy checkout RPC is removed', legacy.removed);
  for (const signature of ['public.create_checkout_order(uuid,jsonb,jsonb,text,uuid)', 'public.set_product_stock(uuid,text,integer)', 'public.save_admin_product(uuid,jsonb)']) {
    const { rows: [rpc] } = await client.query(`SELECT to_regprocedure($1) IS NOT NULL AS present,
      has_function_privilege('anon',to_regprocedure($1),'EXECUTE') AS anon,
      has_function_privilege('authenticated',to_regprocedure($1),'EXECUTE') AS customer,
      has_function_privilege('service_role',to_regprocedure($1),'EXECUTE') AS service`, [signature]);
    check(`${signature} exists and is service-only`, rpc.present && rpc.anon === false && rpc.customer === false && rpc.service === true);
  }
  for (const table of ['products', 'product_size_stock']) {
    for (const role of ['anon', 'authenticated']) {
      for (const operation of ['INSERT','UPDATE','DELETE']) {
        const fn = operation === 'DELETE' ? 'has_table_privilege' : 'has_any_column_privilege';
        const { rows: [privilege] } = await client.query(`SELECT ${fn}($1,$2,$3) AS allowed`, [role, `public.${table}`, operation]);
        check(`${role} ${table} ${operation} denied`, privilege.allowed === false);
      }
    }
  }
  const { rows: imageBuckets } = await client.query("SELECT public,file_size_limit,allowed_mime_types FROM storage.buckets WHERE id='product-images'");
  check('product-images is public with a 2 MiB JPEG/PNG/WebP limit', imageBuckets.length === 1 && imageBuckets[0].public &&
    Number(imageBuckets[0].file_size_limit) === 2097152 && ['image/jpeg','image/png','image/webp'].every(type => imageBuckets[0].allowed_mime_types?.includes(type)) && imageBuckets[0].allowed_mime_types?.length === 3);
  const { rows: storagePolicies } = await client.query("SELECT policyname,cmd,permissive,roles,qual,with_check FROM pg_policies WHERE schemaname='storage' AND tablename='objects'");
  for (const [suffix, command] of [['insert','INSERT'],['update','UPDATE'],['delete','DELETE']]) {
    const policy = storagePolicies.find(row => row.policyname === `admin_product_images_${suffix}_guard`);
    check(`product-image ${command} browser guard`, policy?.cmd === command && policy.permissive === 'RESTRICTIVE' &&
      policy.roles.includes('anon') && policy.roles.includes('authenticated') && (policy.qual ?? policy.with_check)?.includes('product-images'));
  }
  const { rows: [invalid] } = await client.query('SELECT count(*)::int AS count FROM products WHERE price IS NULL OR price < 0 OR price >= 10000000000 OR stock IS NULL OR stock < 0');
  check('no legacy invalid product price/stock rows', invalid.count === 0);

  return findings;
}
