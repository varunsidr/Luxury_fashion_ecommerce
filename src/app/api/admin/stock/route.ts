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
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productId) || !Number.isInteger(stock) || stock < 0 || stock > 2147483647 || (body.size != null && typeof body.size !== "string")) return NextResponse.json({ error: "Invalid stock update." }, { status: 400 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Stock management is not configured." }, { status: 503 });
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const { data: productStock, error } = await admin.rpc('set_product_stock', {
    p_product_id: productId, p_size: size, p_stock: stock,
  });
  if (error?.message?.includes('PRODUCT_NOT_FOUND')) return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
  if (error?.message?.includes('INVALID_OPTION')) return NextResponse.json({ error: 'Choose a configured size; sized stock must be edited per size.' }, { status: 400 });
  if (error) return NextResponse.json({ error: 'Could not update stock. Check the purchase safeguards migration.' }, { status: 500 });
  return NextResponse.json({ status: 'ok', stock: productStock });
}
