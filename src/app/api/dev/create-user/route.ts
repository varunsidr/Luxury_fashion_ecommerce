import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Dev-only endpoint to create confirmed users using the service_role key.
// Behavior:
// - Only enabled when NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.
// - If DEV_CREATE_USER_KEY is set in env, caller must provide header `x-dev-key` with that value.
// - When DEV_CREATE_USER_KEY is not set, the endpoint only works in non-production (NODE_ENV !== 'production').
// - Tracks dev-created accounts using user_metadata.dev_auto and allows up to 10 such users.

export async function POST(req: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const devKey = process.env.DEV_CREATE_USER_KEY;

    if (!supabaseUrl || !svc) {
      return NextResponse.json({ error: 'missing Supabase URL or service role key' }, { status: 500 });
    }

    // If a dev key is configured, require it. Otherwise only allow in non-production.
    const provided = req.headers.get('x-dev-key');
    if (devKey) {
      if (!provided || provided !== devKey) {
        return NextResponse.json({ error: 'missing or invalid dev key' }, { status: 401 });
      }
    } else if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'dev create-user endpoint disabled in production' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? '').trim();
    const password = String(body.password ?? '').trim();
    const fullName = String(body.fullName ?? body.full_name ?? 'Dev User').trim();

    if (!email || !password) {
      return NextResponse.json({ error: 'email and password required' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, svc, { auth: { persistSession: false } });

    // Count already auto-created dev users
    const { data: listData, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    if (listError) return NextResponse.json({ error: listError.message }, { status: 500 });

    const users = listData?.users ?? [];
    const devAutoCount = users.filter((u: any) => u.user_metadata?.dev_auto === true).length;
    const MAX_DEV_AUTO = 10;
    if (devAutoCount >= MAX_DEV_AUTO) {
      return NextResponse.json({ error: 'dev auto-create limit reached', allowed: false }, { status: 403 });
    }

    // Try to create user (this does not send a confirmation email)
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, dev_auto: true },
    });

    if (!createError) {
      return NextResponse.json({ status: 'ok', created: true, userId: created.user?.id });
    }

    // If creation failed because user exists, try to find and update if it was previously dev_auto
    const existing = users.find((u: any) => u.email === email);
    if (!existing) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    // If existing user is a dev_auto user, reset password and confirm
    if (existing.user_metadata?.dev_auto === true) {
      const { data: updated, error: updateError } = await supabase.auth.admin.updateUserById(existing.id, {
        password,
        email_confirm: true,
        user_metadata: { ...existing.user_metadata, full_name: fullName, dev_auto: true },
      });
      if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
      return NextResponse.json({ status: 'ok', created: false, userId: updated.user?.id });
    }

    // Otherwise, do not overwrite existing non-dev user
    return NextResponse.json({ error: 'user exists and is not a dev-auto account' }, { status: 409 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}
