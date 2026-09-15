import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(req: Request) {
  if (!supabaseUrl) return NextResponse.json({ error: 'missing SUPABASE URL' }, { status: 500 });
  // require auth cookie via anon client? We'll use service key server-side for storage handling if available

  try {
    const body = await req.json();
    const { productId, rating, title, comment, images } = body;

    if (!productId || !rating) {
      return NextResponse.json({ error: 'productId and rating are required' }, { status: 400 });
    }

    const supabase = svc ? createClient(supabaseUrl, svc, { auth: { persistSession: false } }) : createClient(supabaseUrl, '');
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    // Insert review (unapproved by default)
    const { data, error } = await supabase.from('reviews').insert({
      product_id: productId,
      user_id: userData.user.id,
      rating,
      title: title ?? null,
      comment: comment ?? null,
      images: images ?? null,
      approved: false,
    }).select().single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ status: 'ok', review: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const productId = url.searchParams.get('productId');
  const onlyApproved = url.searchParams.get('approved') !== 'false';

  if (!productId) return NextResponse.json({ error: 'productId required' }, { status: 400 });

  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    let q = supabase.from('reviews').select('*').eq('product_id', productId).order('created_at', { ascending: false });
    if (onlyApproved) q = q.eq('approved', true);
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ status: 'ok', reviews: data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
