import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getClientAddress, isRateLimited } from "@/lib/rateLimit";

type CheckoutBody = {
  items?: Array<{ id?: unknown; quantity?: unknown; size?: unknown; color?: unknown }>;
  shippingAddress?: {
    fullName?: unknown;
    phone?: unknown;
    address?: unknown;
    city?: unknown;
    postalCode?: unknown;
  };
  paymentMethod?: unknown;
};

const text = (value: unknown, maxLength: number) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

export async function POST(request: Request) {
  if (isRateLimited(`checkout:${getClientAddress(request)}`, 10, 60_000)) {
    return NextResponse.json({ error: "Too many checkout attempts. Please try again shortly." }, { status: 429 });
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    return NextResponse.json({ error: "Checkout is not configured." }, { status: 503 });
  }

  const authorization = request.headers.get("authorization") ?? "";
  const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!accessToken) return NextResponse.json({ error: "Sign in to place an order." }, { status: 401 });

  const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } });
  const { data: authData, error: authError } = await authClient.auth.getUser(accessToken);
  if (authError || !authData.user) return NextResponse.json({ error: "Your session has expired." }, { status: 401 });

  let body: CheckoutBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid checkout request." }, { status: 400 });
  }

  const items = body.items;
  const address = body.shippingAddress;
  if (!Array.isArray(items) || items.length === 0 || items.length > 50 || !address) {
    return NextResponse.json({ error: "Your cart or shipping details are invalid." }, { status: 400 });
  }

  const normalizedItems: Array<{ id: string; quantity: number; size: string | null; color: string | null }> = [];
  for (const item of items) {
    const id = text(item?.id, 100);
    const quantity = Number(item?.quantity);
    const size = text(item?.size, 30) || null;
    const color = text(item?.color, 40) || null;
    if (!id || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      return NextResponse.json({ error: "A cart item is invalid." }, { status: 400 });
    }
    const existing = normalizedItems.find((entry) => entry.id === id && entry.size === size && entry.color === color);
    if (existing) {
      existing.quantity += quantity;
      if (existing.quantity > 20) return NextResponse.json({ error: "A cart item exceeds the quantity limit." }, { status: 400 });
    } else normalizedItems.push({ id, quantity, size, color });
  }

  const shippingAddress = {
    fullName: text(address.fullName, 120),
    phone: text(address.phone, 40),
    address: text(address.address, 500),
    city: text(address.city, 120),
    postalCode: text(address.postalCode, 24),
  };
  if (Object.values(shippingAddress).some((value) => !value)) {
    return NextResponse.json({ error: "Complete all shipping fields." }, { status: 400 });
  }

  const paymentMethod = body.paymentMethod;
  if (paymentMethod !== "card_demo" && paymentMethod !== "cash_on_delivery") {
    return NextResponse.json({ error: "Choose a supported demo payment method." }, { status: 400 });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: inventory, error: inventoryError } = await admin
    .from("products")
    .select("id, stock")
    .in("id", normalizedItems.map((item) => item.id));
  if (inventoryError) {
    return NextResponse.json({ error: "Could not verify product stock. Please try again." }, { status: 503 });
  }
  const stockById = new Map((inventory ?? []).map((product) => [String(product.id), Number(product.stock ?? 0)]));
  const sizedItems = normalizedItems.filter((item) => item.size);
  const { data: sizeInventory, error: sizeInventoryError } = sizedItems.length
    ? await admin.from("product_size_stock").select("product_id, size, stock").in("product_id", [...new Set(sizedItems.map((item) => item.id))])
    : { data: [], error: null };
  if (sizeInventoryError) return NextResponse.json({ error: "Could not verify size stock. Please try again." }, { status: 503 });
  const stockBySize = new Map((sizeInventory ?? []).map((row) => [`${row.product_id}:${row.size}`, Number(row.stock ?? 0)]));
  if (normalizedItems.some((item) => item.size
    ? (stockBySize.get(`${item.id}:${item.size}`) ?? 0) < item.quantity
    : (stockById.get(item.id) ?? 0) < item.quantity)) {
    return NextResponse.json({ error: "One or more items are no longer in stock. Update your cart and try again." }, { status: 409 });
  }

  const { data: created, error: orderError } = await admin.rpc("create_checkout_order", {
    p_user_id: authData.user.id,
    p_items: normalizedItems,
    p_shipping_address: shippingAddress,
    p_payment_method: paymentMethod,
  });
  if (orderError?.message?.includes("OUT_OF_STOCK")) {
    return NextResponse.json({ error: "One or more items are no longer in stock. Update your cart and try again." }, { status: 409 });
  }
  if (orderError || !created?.order_id) return NextResponse.json({ error: "Could not create your order. Apply the checkout transaction migration and try again." }, { status: 500 });
  return NextResponse.json({ orderId: created.order_id, total: created.total });
}
