import { NextResponse } from 'next/server';
import { signToken } from '@/lib/adminAuth';

export async function POST(req: Request) {
  try {
    // support form POST (application/x-www-form-urlencoded) and JSON
    let password = '';
    let username = '';
    const ct = req.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const body = await req.json();
      password = body.password;
      username = body.username ?? '';
    } else if (ct.includes('application/x-www-form-urlencoded')) {
      const form = await req.formData();
      password = String(form.get('password') ?? '');
      username = String(form.get('username') ?? '');
    } else {
      const body = await req.json().catch(() => ({}));
      password = body.password;
      username = body.username ?? '';
    }

    if (!process.env.DEV_CREATE_USER_KEY) return NextResponse.json({ error: 'server missing admin key' }, { status: 500 });
    if (password !== process.env.DEV_CREATE_USER_KEY) return NextResponse.json({ error: 'invalid' }, { status: 401 });

    // if DEV_ADMIN_USERNAME is set, require username match
    const configuredAdmin = process.env.DEV_ADMIN_USERNAME;
    if (configuredAdmin && configuredAdmin !== username) return NextResponse.json({ error: 'invalid user' }, { status: 401 });

    // create token containing admin id (random) and optional username
    const adminId = cryptoRandomId();
    const token = signToken({ adminId, username: username || configuredAdmin || null });

    const res = NextResponse.json({ status: 'ok' });
    const secureFlag = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.headers.set('Set-Cookie', `admin_token=${token}; Path=/; HttpOnly; Max-Age=${60 * 60}; SameSite=Lax${secureFlag}`);
    return res;
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? String(err) }, { status: 500 });
  }
}

function cryptoRandomId() {
  if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') {
    return (crypto as any).randomUUID();
  }
  // fallback
  return Math.random().toString(36).slice(2, 10);
}
