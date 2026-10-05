import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getClientAddress, isRateLimited } from '@/lib/rateLimit';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
const imageTypes = ['image/jpeg', 'image/png', 'image/webp'];

function matchesImageBytes(bytes: Buffer, type: string) {
  if (type === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === 'image/png') return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (type === 'image/webp') return bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
  return false;
}

export async function POST(req: Request) {
  const limited = await isRateLimited(`review-upload:${getClientAddress(req)}`, 8, 60_000);
  if (limited === null) return NextResponse.json({ error: 'Uploads are temporarily unavailable.' }, { status: 503 });
  if (limited) return NextResponse.json({ error: 'Too many uploads. Try again shortly.' }, { status: 429 });
  if (!svc) return NextResponse.json({ error: 'server missing service role key' }, { status: 500 });
  if (!supabaseUrl) return NextResponse.json({ error: 'server missing Supabase URL' }, { status: 500 });
  if (Number(req.headers.get('content-length')) > 7 * 1024 * 1024) return NextResponse.json({ error: 'Upload is too large.' }, { status: 413 });
  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const supabase = createClient(supabaseUrl, svc, { auth: { persistSession: false } });
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const userLimited = await isRateLimited(`review-upload-user:${authData.user.id}`, 10, 24 * 60 * 60_000);
    if (userLimited === null) return NextResponse.json({ error: 'Uploads are temporarily unavailable.' }, { status: 503 });
    if (userLimited) return NextResponse.json({ error: 'Daily upload limit reached.' }, { status: 429 });
    const formData = await req.formData();
    const files = formData.getAll('images') as File[];
    const productId = formData.get('productId') as string | null;
    if (!files.length || files.length > 3 || !productId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productId)) return NextResponse.json({ error: 'Provide a product and one to three images.' }, { status: 400 });
    if (files.some((file) => !(file instanceof File) || file.size < 1 || file.size > 2 * 1024 * 1024 || !imageTypes.includes(file.type))) {
      return NextResponse.json({ error: 'Images must be JPEG, PNG, or WebP files up to 2 MB each.' }, { status: 400 });
    }
    const { data: product } = await supabase.from('products').select('id').eq('id', productId).maybeSingle();
    if (!product) return NextResponse.json({ error: 'Product not found.' }, { status: 404 });

    const prepared = await Promise.all(files.map(async (file) => ({ file, bytes: Buffer.from(await file.arrayBuffer()) })));
    if (prepared.some(({ file, bytes }) => !matchesImageBytes(bytes, file.type))) {
      return NextResponse.json({ error: 'Image content does not match its format.' }, { status: 400 });
    }
    const uploadedPaths: string[] = [];
    for (const { file, bytes } of prepared) {
      // determine filename
      const ext = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as Record<string, string>)[file.type];
      const filename = `reviews/${productId}/${authData.user.id}/${crypto.randomUUID()}.${ext}`;

      const { error } = await supabase.storage
        .from('review-images')
        .upload(filename, bytes, { contentType: file.type });
      if (error) return NextResponse.json({ error: 'Image storage is unavailable.' }, { status: 503 });
      uploadedPaths.push(filename);
    }

    return NextResponse.json({ status: 'ok', paths: uploadedPaths });
  } catch {
    return NextResponse.json({ error: 'Image upload failed.' }, { status: 500 });
  }
}
