"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Image from "next/image";
import { ArrowLeft, ChevronDown, Loader2, Package } from "lucide-react";
import { supabase } from "@/lib/supabase";

type OrderItem = {
  id: string;
  quantity: number;
  unit_price: number;
  product_id: string | null;
  products?: { name: string; image_url: string } | null;
};

type Order = {
  id: string;
  total: number;
  status: string;
  payment_method: string | null;
  placed_at: string;
  order_items: OrderItem[];
};

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 0,
});

const statusLabels: Record<string, string> = {
  pending: "Pending",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(true);
  const [error, setError] = useState("");
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  useEffect(() => {
    async function loadOrders() {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      if (!userId) {
        setSignedIn(false);
        setLoading(false);
        return;
      }

      const { data, error: ordersError } = await supabase
        .from("orders")
        .select("id, total, status, payment_method, placed_at, order_items(id, quantity, unit_price, product_id, products(name, image_url))")
        .eq("user_id", userId)
        .order("placed_at", { ascending: false });

      if (ordersError) setError("We could not load your orders. Please try again.");
      setOrders((data as Order[]) ?? []);
      setLoading(false);
    }

    loadOrders();
  }, []);

  return (
    <main className="min-h-screen bg-neutral-50 px-6 py-12 md:px-12 md:py-20">
      <div className="mx-auto max-w-5xl">
        <Link href="/" className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-neutral-500 transition-colors hover:text-black">
          <ArrowLeft size={14} strokeWidth={1.5} /> Continue shopping
        </Link>
        <div className="mt-10 border-b border-neutral-200 pb-8">
          <p className="text-[10px] uppercase tracking-[0.4em] text-neutral-400">Account</p>
          <h1 className="mt-3 font-playfair text-4xl font-light text-neutral-900">Order history</h1>
          <p className="mt-3 text-sm font-light text-neutral-500">Review your recent purchases and delivery status.</p>
        </div>

        {loading ? (
          <div className="flex flex-col items-center gap-5 py-32 text-center">
            <Loader2 size={34} className="animate-spin text-neutral-300" />
            <p className="text-[10px] uppercase tracking-[0.3em] text-neutral-400">Loading orders</p>
          </div>
        ) : !signedIn ? (
          <div className="py-32 text-center">
            <Package size={48} strokeWidth={0.75} className="mx-auto text-neutral-200" />
            <h2 className="mt-7 font-playfair text-2xl font-light">Sign in to view your orders</h2>
            <p className="mx-auto mt-3 max-w-sm text-sm font-light leading-6 text-neutral-500">Your order history is available after you sign in to your account.</p>
            <Link href="/" className="mt-8 inline-flex bg-black px-8 py-4 text-[10px] font-medium uppercase tracking-[0.25em] text-white hover:bg-neutral-800">Return home to sign in</Link>
          </div>
        ) : error ? (
          <p className="mt-10 border border-red-200 bg-red-50 p-5 text-sm text-red-600">{error}</p>
        ) : orders.length === 0 ? (
          <div className="py-32 text-center">
            <Package size={48} strokeWidth={0.75} className="mx-auto text-neutral-200" />
            <h2 className="mt-7 font-playfair text-2xl font-light">No orders yet</h2>
            <p className="mt-3 text-sm font-light text-neutral-500">Your completed demo purchases will appear here.</p>
            <Link href="/" className="mt-8 inline-flex bg-black px-8 py-4 text-[10px] font-medium uppercase tracking-[0.25em] text-white hover:bg-neutral-800">Start shopping</Link>
          </div>
        ) : (
          <div className="mt-8 space-y-3">
            {orders.map((order) => {
              const expanded = expandedOrder === order.id;
              return (
                <article key={order.id} className="bg-white">
                  <button onClick={() => setExpandedOrder(expanded ? null : order.id)} className="flex w-full items-center justify-between gap-5 p-6 text-left md:p-8">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.25em] text-neutral-400">Order {order.id.slice(0, 8)}</p>
                      <p className="mt-2 text-sm font-light text-neutral-500">{new Date(order.placed_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</p>
                    </div>
                    <div className="flex items-center gap-5">
                      <div className="text-right">
                        <p className="text-sm font-medium">{currency.format(order.total)}</p>
                        <span className="mt-1 inline-block text-[10px] uppercase tracking-[0.2em] text-neutral-500">{statusLabels[order.status] ?? order.status}</span>
                      </div>
                      <ChevronDown size={16} className={`text-neutral-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
                    </div>
                  </button>
                  {expanded && (
                    <div className="border-t border-neutral-100 px-6 pb-6 pt-5 md:px-8">
                      <div className="space-y-3 text-sm">
                        {order.order_items?.map((item) => (
                          <div key={item.id} className="flex items-center justify-between gap-4 text-neutral-600">
                            <div className="flex items-center gap-3">
                              {item.products?.image_url ? <Image src={item.products.image_url} alt={item.products.name} width={40} height={52} className="h-[52px] w-10 object-cover object-top" /> : <div className="h-[52px] w-10 bg-neutral-100" />}
                              <span>{item.products?.name ?? "Product"} × {item.quantity}</span>
                            </div>
                            <span>{currency.format(item.unit_price * item.quantity)}</span>
                          </div>
                        ))}
                      </div>
                      <p className="mt-5 text-xs text-neutral-400">Payment: {order.payment_method === "card_demo" ? "Demo card" : "Cash on delivery"}</p>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
