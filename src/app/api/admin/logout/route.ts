import { NextResponse } from 'next/server';

export async function POST() {
  const res = NextResponse.redirect(new URL('/admin/reviews', process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'));
  const secureFlag = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  // clear the cookie
  res.headers.set('Set-Cookie', `admin_token=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax${secureFlag}`);
  return res;
}

export async function GET() {
  // Allow GET for convenience in browsers
  return POST();
}
