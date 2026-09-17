import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// NOTE: This endpoint must be protected in CI / production. It uses the service role key.
// Provisions (or resets the password of) a fixed test user so Playwright can log in
// via API and reuse a storageState, instead of driving the UI login form every run.

export async function POST(req: Request) {
  const provided = req.headers.get('x-supabase-service-role');
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!svc || provided !== svc) {
    return NextResponse.json({ error: 'missing or invalid service role key' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    return NextResponse.json({ error: 'missing NEXT_PUBLIC_SUPABASE_URL' }, { status: 500 });
  }

  let body: { email?: string; password?: string; fullName?: string } = {};
  try {
    body = await req.json();
  } catch {
    // no body provided, fall back to defaults
  }

  const email = body.email ?? process.env.TEST_USER_EMAIL;
  const password = body.password ?? process.env.TEST_USER_PASSWORD;
  const fullName = body.fullName ?? 'Playwright Test User';

  if (!email || !password) {
    return NextResponse.json({ error: 'email and password are required (or set TEST_USER_EMAIL / TEST_USER_PASSWORD)' }, { status: 400 });
  }

  const supabase = createClient(supabaseUrl, svc, { auth: { persistSession: false } });

  try {
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (!createError) {
      return NextResponse.json({ status: 'ok', userId: created.user?.id, created: true });
    }

    // user likely already exists — find it and reset its password instead
    const { data: list, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (listError) {
      return NextResponse.json({ error: listError.message }, { status: 500 });
    }

    const existing = list.users.find((u) => u.email === email);
    if (!existing) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    const { data: updated, error: updateError } = await supabase.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ status: 'ok', userId: updated.user?.id, created: false });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
