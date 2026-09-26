import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

type CheckoutBody = {
  items?: Array<{ id?: unknown; quantity?: unknown }>;
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

  const normalizedItems: Array<{ id: string; quantity: number }> = [];
  for (const item of items) {
    const id = text(item?.id, 100);
    const quantity = Number(item?.quantity);
    if (!id || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      return NextResponse.json({ error: "A cart item is invalid." }, { status: 400 });
    }
    normalizedItems.push({ id, quantity });
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
  const productIds = [...new Set(normalizedItems.map((item) => item.id))];
  const { data: products, error: productsError } = await admin
    .from("products")
    .select("id, price")
    .in("id", productIds);
  if (productsError) return NextResponse.json({ error: "Could not verify product prices." }, { status: 500 });

  const productById = new Map((products ?? []).map((product) => [String(product.id), Number(product.price)]));
  if (productById.size !== productIds.length || [...productById.values()].some((price) => !Number.isFinite(price) || price < 0)) {
    return NextResponse.json({ error: "One or more products are no longer available." }, { status: 409 });
  }

  const orderItems = normalizedItems.map((item) => ({
    product_id: item.id,
    quantity: item.quantity,
    unit_price: productById.get(item.id)!,
  }));
  const total = orderItems.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);

  const { error: profileError } = await admin.from("profiles").upsert({
    id: authData.user.id,
    full_name: shippingAddress.fullName,
  }, { onConflict: "id" });
  if (profileError) return NextResponse.json({ error: "Could not prepare your customer profile." }, { status: 500 });

  const { data: order, error: orderError } = await admin.from("orders").insert({
    user_id: authData.user.id,
    total,
    status: "pending",
    shipping_address: shippingAddress,
    payment_method: paymentMethod,
  }).select("id").single();
  if (orderError || !order) return NextResponse.json({ error: "Could not create your order." }, { status: 500 });

  const { error: itemsError } = await admin.from("order_items").insert(
    orderItems.map((item) => ({ ...item, order_id: order.id }))
  );
  if (itemsError) {
    await admin.from("orders").delete().eq("id", order.id);
    return NextResponse.json({ error: "Could not save your order items. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ orderId: order.id, total });
}
