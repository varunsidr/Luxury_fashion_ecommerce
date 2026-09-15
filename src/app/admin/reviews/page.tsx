import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';
import { verifyToken } from '@/lib/adminAuth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function AdminReviewsPage() {
  if (!svc) {
    return (<div className="p-6">Missing service role key on server. Set SUPABASE_SERVICE_ROLE_KEY.</div>);
  }

  // Read cookie header robustly to handle different Next.js runtimes/bridges
  let cookieHeader = '';
  try {
    const h = await headers();
    // preferred: Headers.get
    if (typeof (h as any).get === 'function') {
      cookieHeader = (h as any).get('cookie') ?? '';
    } else if ((h as any)['cookie']) {
      // some runtimes expose keys directly
      cookieHeader = (h as any)['cookie'] ?? '';
    } else if (Symbol.iterator in Object(h)) {
      // iterable headers -> array of [k,v]
      for (const [k, v] of h as any) {
        if (k && String(k).toLowerCase() === 'cookie') {
          cookieHeader = String(v ?? '');
          break;
        }
      }
    }
  } catch (err) {
    cookieHeader = '';
  }
  const token = cookieHeader.split(';').map((s) => s.trim()).find((s) => s.startsWith('admin_token='))?.split('=')[1];
  if (!token) {
    // render simple server-side login form
    return (
      <div className="p-6">
        <h1 className="text-2xl mb-4">Admin login</h1>
        <form method="post" action="/api/admin/login">
          <label className="block mb-2">Username</label>
          <input name="username" type="text" className="border p-2 mb-3" />
          <label className="block mb-2">Password</label>
          <input name="password" type="password" className="border p-2 mb-3" />
          <button type="submit" className="px-3 py-1 bg-neutral-900 text-white">Sign in</button>
        </form>
      </div>
    );
  }

  const payload = verifyToken(token);
  if (!payload) {
    return (<div className="p-6">Invalid or expired session. Please log in again.</div>);
  }

  const supabase = createClient(supabaseUrl, svc, { auth: { persistSession: false } });
  const { data: reviews, error } = await supabase.from('reviews').select('*').eq('approved', false).order('created_at', { ascending: false });
  if (error) return (<div className="p-6">Error: {error.message}</div>);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-medium">Pending Reviews</h1>
        <form method="post" action="/api/admin/logout">
          <button type="submit" className="px-3 py-1 bg-neutral-100 border">Logout</button>
        </form>
      </div>
      {reviews && reviews.length === 0 && (<p>No pending reviews.</p>)}
      <div className="grid gap-4">
        {reviews?.map((rev: any) => (
          <div key={rev.id} className="border p-4 bg-white">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-medium">Reviewer</div>
                <div className="text-xs text-neutral-500">{rev.user_id ?? 'Unknown user'}</div>
                <div className="text-sm text-neutral-600">{new Date(rev.created_at).toLocaleString()}</div>
              </div>
              <div className="flex gap-2">
                <form action={`/api/admin/reviews/approve/${rev.id}`} method="post">
                  <button type="submit" className="px-3 py-1 bg-green-600 text-white">Approve</button>
                </form>
                <form action={`/api/admin/reviews/delete/${rev.id}`} method="post">
                  <button type="submit" className="px-3 py-1 bg-red-600 text-white">Delete</button>
                </form>
              </div>
            </div>
            <p className="mt-3 mb-2 text-neutral-700">{rev.comment}</p>
            <p className="text-sm text-neutral-500">Rating: {rev.rating}/5</p>
            {rev.images && rev.images.length > 0 && (
              <div className="flex gap-2 mt-2">
                {rev.images.map((src: string, i: number) => (
                  <img key={i} src={src} className="w-24 h-24 object-cover border" />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
