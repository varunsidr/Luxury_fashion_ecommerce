import crypto from 'crypto';

const ALG = 'HS256';

function sessionSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET || '';
  if (secret.length >= 32) return secret;
  return process.env.NODE_ENV === 'production' ? '' : process.env.DEV_CREATE_USER_KEY || '';
}

export function adminCredentialsConfigured() {
  return Boolean(sessionSecret() && process.env.ADMIN_CREDENTIALS);
}

export async function verifyAdminCredentials(username: string, password: string): Promise<boolean> {
  if (!username || !password || !process.env.ADMIN_CREDENTIALS) return false;
  let credentials: Record<string, unknown>;
  try {
    credentials = JSON.parse(process.env.ADMIN_CREDENTIALS);
  } catch { return false; }
  if (!credentials || typeof credentials !== 'object' || Array.isArray(credentials)) return false;
  const encoded = credentials[username];
  if (typeof encoded !== 'string') return false;
  const parts = encoded.split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt' || !/^[0-9a-f]{32}$/i.test(parts[1]) || !/^[0-9a-f]{128}$/i.test(parts[2])) return false;
  const expected = Buffer.from(parts[2], 'hex');
  const actual = await new Promise<Buffer>((resolve, reject) =>
    crypto.scrypt(password, Buffer.from(parts[1], 'hex'), expected.length, (error, derived) =>
      error ? reject(error) : resolve(derived as Buffer)));
  return crypto.timingSafeEqual(actual, expected);
}

function base64url(input: Buffer | string) {
  const b = Buffer.isBuffer(input) ? input : Buffer.from(String(input));
  return b.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64urlDecode(str: string) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return Buffer.from(str, 'base64').toString('utf8');
}

export function signToken(payload: Record<string, unknown>, expiresInSec = 60 * 60) {
  const secret = sessionSecret();
  if (!secret) throw new Error('Missing ADMIN_SESSION_SECRET');
  const header = { alg: ALG, typ: 'JWT' };
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + expiresInSec;
  const body = { ...payload, iat, exp };
  const toSign = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(body))}`;
  const sig = crypto.createHmac('sha256', secret).update(toSign).digest();
  return `${toSign}.${base64url(sig)}`;
}

export function verifyToken(token: string) {
  const secret = sessionSecret();
  if (!secret) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [h, b, s] = parts;
    const toSign = `${h}.${b}`;
    const expectedSig = crypto.createHmac('sha256', secret).update(toSign).digest();
    const sigBuf = Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    if (sigBuf.length !== expectedSig.length) return null;
    if (!crypto.timingSafeEqual(expectedSig, sigBuf)) return null;
    const header = JSON.parse(base64urlDecode(h));
    if (header.alg !== ALG || header.typ !== 'JWT') return null;
    const payload = JSON.parse(base64urlDecode(b));
    const now = Math.floor(Date.now() / 1000);
    if (!Number.isInteger(payload.exp) || payload.exp <= now || !Number.isInteger(payload.iat) || payload.iat > now + 30 || typeof payload.adminId !== 'string') return null;
    return payload;
  } catch {
    return null;
  }
}
