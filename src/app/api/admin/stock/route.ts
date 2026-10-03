import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyToken } from "@/lib/adminAuth";

export async function PATCH(request: Request) {
  const token = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith("admin_token="))?.slice("admin_token=".length);
  if (!verifyToken(token ?? "")) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const productId = typeof body.productId === "string" ? body.productId : "";
  const size = typeof body.size === "string" ? body.size.trim() || null : null;
  const stock = Number(body.stock);
  if (!/^[0-9a-f-]{36}$/i.test(productId) || !Number.isInteger(stock) || stock < 0) return NextResponse.json({ error: "Invalid stock update." }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Stock management is not configured." }, { status: 503 });
  const admin = createClient(url, key, { auth: { persistSession: false } });
  let productStock = stock;

  if (size) {
    const { error } = await admin.from("product_size_stock").upsert({ product_id: productId, size, stock }, { onConflict: "product_id,size" });
    if (error) return NextResponse.json({ error: "Could not update size stock." }, { status: 500 });
    const { data: rows, error: rowsError } = await admin.from("product_size_stock").select("stock").eq("product_id", productId);
    if (rowsError) return NextResponse.json({ error: "Could not calculate product stock." }, { status: 500 });
    productStock = (rows ?? []).reduce((sum, row) => sum + Number(row.stock ?? 0), 0);
    const { error: productError } = await admin.from("products").update({ stock: productStock }).eq("id", productId);
    if (productError) return NextResponse.json({ error: "Could not update product stock." }, { status: 500 });
  } else {
    const { error } = await admin.from("products").update({ stock }).eq("id", productId);
    if (error) return NextResponse.json({ error: "Could not update product stock." }, { status: 500 });
  }
  return NextResponse.json({ status: "ok", stock: productStock });
}
