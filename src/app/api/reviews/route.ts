import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getClientAddress, isRateLimited } from '@/lib/rateLimit';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(req: Request) {
  const limited = await isRateLimited(`review:${getClientAddress(req)}`, 5, 60_000);
  if (limited === null) return NextResponse.json({ error: 'Reviews are temporarily unavailable.' }, { status: 503 });
  if (limited) return NextResponse.json({ error: 'Too many review attempts. Try again shortly.' }, { status: 429 });
  if (!supabaseUrl || !anonKey || !svc) return NextResponse.json({ error: 'Reviews are not configured.' }, { status: 503 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid review.' }, { status: 400 }); }
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid review.' }, { status: 400 });
  try {
    const { productId, rating, title, comment, images } = body as Record<string, unknown>;

    if (typeof productId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productId) || typeof rating !== 'number' || !Number.isInteger(rating) || rating < 1 || rating > 5 ||
        (title != null && (typeof title !== 'string' || title.length > 160)) ||
        typeof comment !== 'string' || !comment.trim() || comment.length > 4000 ||
        (images != null && (!Array.isArray(images) || images.length > 3 || images.some((image) => typeof image !== 'string' || image.length > 2048)))) {
      return NextResponse.json({ error: 'A valid product, rating and comment are required.' }, { status: 400 });
    }
    const imageList = images as string[] | null | undefined;

    const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const { data: userData, error: userError } = await authClient.auth.getUser(token);
    if (userError || !userData.user) return NextResponse.json({ error: "Authentication required" }, { status: 401 });

    const imagePrefix = `reviews/${productId}/${userData.user.id}/`;
    if (imageList?.some((image) => {
      return !image.startsWith(imagePrefix) ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/i.test(image.slice(imagePrefix.length));
    })) return NextResponse.json({ error: 'Invalid review image.' }, { status: 400 });

    const admin = createClient(supabaseUrl, svc, { auth: { persistSession: false } });
    const { data, error } = await admin.from('reviews').insert({
      product_id: productId,
      user_id: userData.user.id,
      rating,
      title: title ?? null,
      comment: comment.trim(),
      images: images ?? null,
      approved: false,
    }).select('id').single();

    if (error) {
      return NextResponse.json({ error: 'Could not save review.' }, { status: 500 });
    }

    return NextResponse.json({ status: 'pending', reviewId: data.id }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Could not save review.' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const productId = url.searchParams.get('productId');

  if (!productId) return NextResponse.json({ error: 'productId required' }, { status: 400 });

  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const q = supabase.from('reviews').select('*').eq('product_id', productId).eq('approved', true).order('created_at', { ascending: false });
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: 'Could not load reviews.' }, { status: 500 });
    return NextResponse.json({ status: 'ok', reviews: data });
  } catch {
    return NextResponse.json({ error: 'Could not load reviews.' }, { status: 500 });
  }
}
