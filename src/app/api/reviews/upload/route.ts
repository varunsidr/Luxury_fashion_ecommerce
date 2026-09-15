import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(req: Request) {
  if (!svc) return NextResponse.json({ error: 'server missing service role key' }, { status: 500 });
  try {
    const formData = await req.formData();
    const files = formData.getAll('images') as File[];
    const productId = formData.get('productId') as string | null;
    if (!files || files.length === 0) return NextResponse.json({ error: 'no files' }, { status: 400 });
    const supabase = createClient(supabaseUrl, svc, { auth: { persistSession: false } });

    const uploadedPaths: string[] = [];
    for (const file of files) {
      // validate size <= 2MB
      if (file.size > 2 * 1024 * 1024) {
        return NextResponse.json({ error: 'file too large' }, { status: 400 });
      }
      // determine filename
      const arrayBuffer = await file.arrayBuffer();
      const buf = Buffer.from(arrayBuffer);
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
      const filename = `reviews/${productId ?? 'unknown'}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;

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
