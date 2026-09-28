import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getClientAddress, isRateLimited } from '@/lib/rateLimit';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(req: Request) {
  if (isRateLimited(`review-upload:${getClientAddress(req)}`, 8, 60_000)) return NextResponse.json({ error: 'Too many uploads. Try again shortly.' }, { status: 429 });
  if (!svc) return NextResponse.json({ error: 'server missing service role key' }, { status: 500 });
  if (!supabaseUrl) return NextResponse.json({ error: 'server missing Supabase URL' }, { status: 500 });
  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const supabase = createClient(supabaseUrl, svc, { auth: { persistSession: false } });
    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const formData = await req.formData();
    const files = formData.getAll('images') as File[];
    const productId = formData.get('productId') as string | null;
    if (!files.length || files.length > 3 || !productId || productId.length > 100) return NextResponse.json({ error: 'Provide a product and one to three images.' }, { status: 400 });
    if (files.some((file) => !(file instanceof File) || file.size > 2 * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type))) {
      return NextResponse.json({ error: 'Images must be JPEG, PNG, or WebP files up to 2 MB each.' }, { status: 400 });
    }
    const { data: product } = await supabase.from('products').select('id').eq('id', productId).maybeSingle();
    if (!product) return NextResponse.json({ error: 'Product not found.' }, { status: 404 });

    const uploadedPaths: string[] = [];
    for (const file of files) {
      // determine filename
      const arrayBuffer = await file.arrayBuffer();
      const buf = Buffer.from(arrayBuffer);
      const ext = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as Record<string, string>)[file.type];
      const filename = `reviews/${productId}/${authData.user.id}/${crypto.randomUUID()}.${ext}`;

      const { data, error } = await supabase.storage
        .from('public')
        .upload(filename, buf, { contentType: file.type });
      if (error) {
        // If bucket does not exist, try to create it (useful for fresh projects)
        if (error.message && error.message.toLowerCase().includes('bucket not found')) {
          try {
            const { data: createData, error: createErr } = await supabase.storage.createBucket('public', { public: true });
            if (createErr) {
              return NextResponse.json({ error: `Bucket missing and creation failed: ${createErr.message}` }, { status: 500 });
            }
            // Retry upload once after creating bucket
            const { data: data2, error: error2 } = await supabase.storage.from('public').upload(filename, buf, { contentType: file.type });
            if (error2) return NextResponse.json({ error: error2.message }, { status: 500 });
            const { data: publicData } = supabase.storage.from('public').getPublicUrl(filename);
            uploadedPaths.push(publicData.publicUrl);
            continue;
          } catch (createErr2: any) {
            return NextResponse.json({ error: createErr2?.message ?? String(createErr2) }, { status: 500 });
          }
        }
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      const { data: publicData } = supabase.storage.from('public').getPublicUrl(filename);
      uploadedPaths.push(publicData.publicUrl);
    }

    return NextResponse.json({ status: 'ok', paths: uploadedPaths });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
