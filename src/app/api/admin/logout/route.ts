import { NextResponse } from 'next/server';

function clearCookie(res: NextResponse) {
  const secureFlag = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  // clear the cookie
  res.headers.set('Set-Cookie', `admin_token=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax${secureFlag}`);
  return res;
}

export async function POST() {
  return clearCookie(NextResponse.json({ status: 'ok' }, { headers: { 'Cache-Control': 'no-store' } }));
}

export async function GET() {
  // A relative Location keeps the browser on its actual origin, even when a
  // reverse proxy supplies a different internal request URL.
  return clearCookie(new NextResponse(null, { status: 303, headers: { Location: '/admin', 'Cache-Control': 'no-store' } }));
}
