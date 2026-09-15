import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ADMIN_HEADER = 'x-dev-key';
const ADMIN_KEY = process.env.DEV_CREATE_USER_KEY || process.env.ADMIN_KEY;

function unauthorized() {
  return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const cookie = req.headers.get('cookie') ?? '';
  const token = cookie.split(';').map(s => s.trim()).find(s => s.startsWith('admin_token='))?.split('=')[1];
  if (!token) return unauthorized();
  const { verifyToken } = await import('@/lib/adminAuth');
  const payload = verifyToken(token);
  if (!payload) return unauthorized();
  if (!svc) return NextResponse.json({ error: 'missing service role key' }, { status: 500 });
  try {
    const { id } = await params;
    const supabase = createClient(supabaseUrl, svc, { auth: { persistSession: false } });
    // Approve the review
    const { data, error } = await supabase
      .from('reviews')
      .update({ approved: true, moderated_at: new Date().toISOString(), moderated_by: payload.adminId })
      .eq('id', id)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ status: 'ok', review: data });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const provided = req.headers.get(ADMIN_HEADER) ?? '';
  if (!ADMIN_KEY || provided !== ADMIN_KEY) return unauthorized();
  if (!svc) return NextResponse.json({ error: 'missing service role key' }, { status: 500 });
  try {
    const { id } = await params;
    const supabase = createClient(supabaseUrl, svc, { auth: { persistSession: false } });
    const { error } = await supabase.from('reviews').delete().eq('id', id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ status: 'ok' });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
