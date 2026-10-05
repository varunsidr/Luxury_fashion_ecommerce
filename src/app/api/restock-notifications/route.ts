import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";
import { getClientAddress, isRateLimited } from "@/lib/rateLimit";

export async function POST(request: Request) {
  const limited = await isRateLimited(`restock:${getClientAddress(request)}`, 5, 60_000);
  if (limited === null) return NextResponse.json({ error: "Restock alerts are temporarily unavailable." }, { status: 503 });
  if (limited) {
    return NextResponse.json({ error: "Too many requests. Please try again shortly." }, { status: 429 });
  }

  let body: { productId?: unknown; email?: unknown; size?: unknown; color?: unknown };
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }

  const productId = typeof body.productId === "string" ? body.productId.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const size = typeof body.size === "string" ? body.size.trim().slice(0, 30) || null : null;
  const color = typeof body.color === "string" ? body.color.trim().slice(0, 40) || null : null;
  if (!/^[0-9a-f-]{36}$/i.test(productId) || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return NextResponse.json({ error: "Restock alerts are not configured." }, { status: 503 });
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  const { data: product, error: productError } = await admin.from("products").select("id").eq("id", productId).maybeSingle();
  if (productError || !product) return NextResponse.json({ error: "This product could not be found." }, { status: 404 });

  let existingQuery = admin.from("restock_notifications").select("id").eq("product_id", productId).ilike("email", email).is("notified_at", null);
  existingQuery = size ? existingQuery.eq("size", size) : existingQuery.is("size", null);
  existingQuery = color ? existingQuery.eq("color", color) : existingQuery.is("color", null);
  const { data: existing, error: lookupError } = await existingQuery.maybeSingle();
  if (lookupError) return NextResponse.json({ error: "Could not save the request. Apply the restock migration and try again." }, { status: 503 });
  const emailConfigured = Boolean(process.env.RESEND_API_KEY && process.env.RESTOCK_FROM_EMAIL);
  if (existing) return NextResponse.json({ status: "already_subscribed", emailConfigured });

  const unsubscribeToken = randomBytes(32).toString("hex");
  const { error } = await admin.from("restock_notifications").insert({ product_id: productId, email, size, color, unsubscribe_token: unsubscribeToken });
  if (error) return NextResponse.json({ error: "Could not save the request. Please try again." }, { status: 500 });
  return NextResponse.json({ status: "subscribed", emailConfigured }, { status: 201 });
}
