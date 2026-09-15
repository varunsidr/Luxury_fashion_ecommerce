import crypto from 'crypto';

const SECRET = process.env.DEV_CREATE_USER_KEY || '';
const ALG = 'HS256';

function base64url(input: Buffer | string) {
  const b = Buffer.isBuffer(input) ? input : Buffer.from(String(input));
  return b.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64urlDecode(str: string) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64').toString('utf8');
}

export function signToken(payload: Record<string, any>, expiresInSec = 60 * 60) {
  if (!SECRET) throw new Error('Missing DEV_CREATE_USER_KEY');
  const header = { alg: ALG, typ: 'JWT' };
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + expiresInSec;
  const body = { ...payload, iat, exp };
  const toSign = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(body))}`;
  const sig = crypto.createHmac('sha256', SECRET).update(toSign).digest();
  return `${toSign}.${base64url(sig)}`;
}

export function verifyToken(token: string) {
  if (!SECRET) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [h, b, s] = parts;
    const toSign = `${h}.${b}`;
    const expectedSig = crypto.createHmac('sha256', SECRET).update(toSign).digest();
    const sigBuf = Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    if (!crypto.timingSafeEqual(expectedSig, sigBuf)) return null;
    const payload = JSON.parse(base64urlDecode(b));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && now > payload.exp) return null;
    return payload;
  } catch (err) {
    return null;
  }
}
