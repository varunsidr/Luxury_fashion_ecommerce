import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyToken } from "@/lib/adminAuth";

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
    .select("*, order_items(id, quantity, unit_price, product_id, products(name, image_url))")
    .order("placed_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ orders: data ?? [] });
}

export async function PATCH(request: Request) {
  if (!isAdmin(request)) return unauthorized();
  const supabase = adminClient();
  if (!supabase) return NextResponse.json({ error: "missing Supabase configuration" }, { status: 500 });

  const body = await request.json().catch(() => ({}));
  const allowedStatuses = ["pending", "processing", "shipped", "delivered", "cancelled"];
  if (!allowedStatuses.includes(body.status) || typeof body.id !== "string") {
    return NextResponse.json({ error: "invalid order status or id" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("orders")
    .update({ status: body.status })
    .eq("id", body.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ order: data });
}
