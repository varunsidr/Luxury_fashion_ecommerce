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
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const productId = typeof body.productId === "string" ? body.productId.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const size = typeof body.size === "string" ? body.size.trim() || null : null;
  const color = typeof body.color === "string" ? body.color.trim() || null : null;
  if (body.size != null && typeof body.size !== "string" || body.color != null && typeof body.color !== "string" ||
    (size?.length ?? 0) > 30 || (color?.length ?? 0) > 40) {
    return NextResponse.json({ error: "Choose a valid product option." }, { status: 400 });
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productId) || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) return NextResponse.json({ error: "Restock alerts are not configured." }, { status: 503 });
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  const emailConfigured = Boolean(process.env.RESEND_API_KEY && process.env.RESTOCK_FROM_EMAIL);
  const unsubscribeToken = randomBytes(32).toString("hex");
  const { data: status, error } = await admin.rpc("subscribe_restock", {
    p_product_id: productId, p_email: email, p_size: size, p_color: color, p_token: unsubscribeToken,
  });
  if (error?.message.includes("PRODUCT_NOT_FOUND")) return NextResponse.json({ error: "This product could not be found." }, { status: 404 });
  if (error?.message.includes("INVALID_OPTION")) return NextResponse.json({ error: "Choose a configured product option." }, { status: 400 });
  if (error?.message.includes("ALREADY_AVAILABLE")) return NextResponse.json({ error: "This option is available now. Refresh the product page to shop." }, { status: 409 });
  if (error) return NextResponse.json({ error: "Could not save your request. Check the restock delivery migration and try again." }, { status: 503 });
  return NextResponse.json({ status, emailConfigured }, { status: status === "subscribed" ? 201 : 200 });
}
