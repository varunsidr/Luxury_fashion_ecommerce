import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyToken } from "@/lib/adminAuth";
import { isRateLimited } from "@/lib/rateLimit";

function isAdmin(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  const token = cookie.split(";").map((value) => value.trim()).find((value) => value.startsWith("admin_token="))?.split("=")[1];
  return token ? verifyToken(token) : null;
}

function unauthorized() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) return null;
  return createClient(url, serviceRoleKey, { auth: { persistSession: false } });
}

export async function GET(request: Request) {
  if (!isAdmin(request)) return unauthorized();
  const supabase = adminClient();
  if (!supabase) return NextResponse.json({ error: "missing Supabase configuration" }, { status: 500 });

  const { data, error } = await supabase
    .from("orders")
    .select("*, order_items(id, quantity, unit_price, product_id, size, color, products(name, image_url))")
    .order("placed_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ orders: data ?? [] });
}

export async function PATCH(request: Request) {
  const admin = isAdmin(request);
  if (!admin) return unauthorized();
  const origin = request.headers.get("origin");
  if (request.headers.get("sec-fetch-site") === "cross-site" || origin && origin !== new URL(request.url).origin) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const limited = await isRateLimited(`admin-orders:${admin.adminId}`, 60, 60_000);
  if (limited === null) return NextResponse.json({ error: "Order updates are temporarily unavailable." }, { status: 503 });
  if (limited) return NextResponse.json({ error: "Too many changes. Please wait." }, { status: 429 });
  const supabase = adminClient();
  if (!supabase) return NextResponse.json({ error: "missing Supabase configuration" }, { status: 500 });

  const body = await request.json().catch(() => ({}));
  const allowedStatuses = ["pending", "processing", "shipped", "delivered", "cancelled"];
  if (!allowedStatuses.includes(body.status) || typeof body.id !== "string" || !/^[0-9a-f-]{36}$/i.test(body.id)) {
    return NextResponse.json({ error: "invalid order status or id" }, { status: 400 });
  }

  try {
    const { data, error } = await supabase.rpc("set_admin_order_status", { p_order_id: body.id, p_status: body.status });
    if (error) {
      if (error.message.includes("ORDER_NOT_FOUND")) return NextResponse.json({ error: "Order not found." }, { status: 404 });
      if (error.message.includes("INVALID_TRANSITION")) return NextResponse.json({ error: "This status change is no longer allowed. Refresh the order." }, { status: 409 });
      if (error.message.includes("INVENTORY_CONFIGURATION_CHANGED")) return NextResponse.json({ error: "Product sizes changed after purchase. Reconcile the original inventory configuration before cancelling." }, { status: 409 });
      return NextResponse.json({ error: "Could not update the order. Check the order lifecycle migration and retry." }, { status: 503 });
    }
    return NextResponse.json({ order: data }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ error: "Order updates are temporarily unavailable." }, { status: 503 }); }
}
