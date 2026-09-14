import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// NOTE: This endpoint must be protected in CI / production. It uses the service role key.

export async function POST(req: Request) {
  const provided = req.headers.get('x-supabase-service-role');
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!svc || (provided && provided !== svc)) {
    return NextResponse.json({ error: 'missing or invalid service role key' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    return NextResponse.json({ error: 'missing NEXT_PUBLIC_SUPABASE_URL' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, svc, { auth: { persistSession: false } });

  try {
    // delete core tables
    await supabase.from('favorites').delete();
    await supabase.from('cart_items').delete();
    await supabase.from('reviews').delete();
    await supabase.from('products').delete();
    // do not delete auth.users via client; profiles will be handled if needed

    // insert seeded products
    // products data lives in scripts/products-data.js
    // require dynamically to avoid ESM/TS import issues
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { allProducts } = require('../../../../../scripts/products-data');

    if (!Array.isArray(allProducts)) {
      return NextResponse.json({ error: 'no product data available' }, { status: 500 });
    }

    const { data, error } = await supabase.from('products').insert(allProducts).select();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ status: 'ok', inserted: data?.length ?? 0 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
