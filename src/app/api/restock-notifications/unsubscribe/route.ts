import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

async function unsubscribe(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!/^[0-9a-f]{64}$/i.test(token)) return NextResponse.json({ error: "This unsubscribe link is invalid." }, { status: 400 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Unsubscribe is temporarily unavailable." }, { status: 503 });
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const { error } = await admin.from("restock_notifications").delete().eq("unsubscribe_token", token);
  if (error) return NextResponse.json({ error: "Unsubscribe is temporarily unavailable." }, { status: 503 });
  return new Response("You have been unsubscribed from this restock alert.", {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}

export async function GET(request: Request) { return unsubscribe(request); }
export async function POST(request: Request) { return unsubscribe(request); }
