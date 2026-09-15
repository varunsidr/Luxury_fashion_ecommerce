import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookie = req.headers.get('cookie') ?? '';
  const token = cookie.split(';').map(s => s.trim()).find(s => s.startsWith('admin_token='))?.split('=')[1];
  if (!token) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { verifyToken } = await import('@/lib/adminAuth');
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!svc) return NextResponse.json({ error: 'missing service role key' }, { status: 500 });
  try {
    const { id } = await params;
    const supabase = createClient(supabaseUrl, svc, { auth: { persistSession: false } });
    const { error } = await supabase.from('reviews').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ status: 'ok' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
