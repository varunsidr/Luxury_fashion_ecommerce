import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_HEADER = 'x-dev-key';
const ADMIN_KEY = process.env.DEV_CREATE_USER_KEY || process.env.ADMIN_KEY;

function unauthorized() {
  return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
}

export async function GET(req: Request) {
  // validate admin_token JWT cookie
  const cookie = req.headers.get('cookie') ?? '';
  const token = cookie.split(';').map(s => s.trim()).find(s => s.startsWith('admin_token='))?.split('=')[1];
  if (!token) return unauthorized();
  const { verifyToken } = await import('@/lib/adminAuth');
  const payload = verifyToken(token);
  if (!payload) return unauthorized();
  const url = new URL(req.url);
  const status = url.searchParams.get('status') || 'pending';

  if (!svc) return NextResponse.json({ error: 'missing service role key' }, { status: 500 });

  const supabase = createClient(supabaseUrl, svc, { auth: { persistSession: false } });
  try {
    let q = supabase.from('reviews').select('*').order('created_at', { ascending: false });
    if (status === 'pending') q = q.eq('approved', false);
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ status: 'ok', reviews: data });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
