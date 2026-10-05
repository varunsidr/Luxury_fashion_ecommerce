import { NextResponse } from 'next/server';
import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { adminCredentialsConfigured, signToken, verifyAdminCredentials } from '@/lib/adminAuth';
import { getClientAddress, isRateLimited } from '@/lib/rateLimit';

export async function POST(req: Request) {
  const limited = await isRateLimited(`admin-login:${getClientAddress(req)}`, 5, 60_000);
  if (limited === null) return NextResponse.json({ error: 'Admin sign in is temporarily unavailable.' }, { status: 503 });
  if (limited) return NextResponse.json({ error: 'Too many login attempts. Try again shortly.' }, { status: 429 });
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

    const accountLimited = await isRateLimited(`admin-login-account:${String(username).trim().toLowerCase()}`, 5, 60_000);
    if (accountLimited === null) return NextResponse.json({ error: 'Admin sign in is temporarily unavailable.' }, { status: 503 });
    if (accountLimited) return NextResponse.json({ error: 'Too many login attempts. Try again shortly.' }, { status: 429 });

    let valid = false;
    if (adminCredentialsConfigured()) {
      valid = await verifyAdminCredentials(String(username), String(password));
    } else if (process.env.NODE_ENV !== 'production' && process.env.DEV_CREATE_USER_KEY) {
      const expected = Buffer.from(process.env.DEV_CREATE_USER_KEY);
      const actual = Buffer.from(String(password));
      valid = actual.length === expected.length && timingSafeEqual(actual, expected) &&
        (!process.env.DEV_ADMIN_USERNAME || process.env.DEV_ADMIN_USERNAME === username);
    } else {
      return NextResponse.json({ error: 'Admin sign in is not configured.' }, { status: 503 });
    }
    if (!valid) return NextResponse.json({ error: 'invalid' }, { status: 401 });

    const adminName = String(username || process.env.DEV_ADMIN_USERNAME || 'local-admin');
    const digest = createHash('sha256').update(`zeouf-admin:${adminName}`).digest('hex');
    const adminId = `${digest.slice(0, 8)}-${digest.slice(8, 12)}-${digest.slice(12, 16)}-${digest.slice(16, 20)}-${digest.slice(20, 32)}`;
    const token = signToken({ adminId, username: adminName, sessionId: randomUUID() });

    const res = NextResponse.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } });
    const secureFlag = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    res.headers.set('Set-Cookie', `admin_token=${token}; Path=/; HttpOnly; Max-Age=${60 * 60}; SameSite=Lax${secureFlag}`);
    return res;
  } catch {
    return NextResponse.json({ error: 'Admin sign in failed.' }, { status: 500 });
  }
}
