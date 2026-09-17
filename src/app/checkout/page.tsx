"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, Check, Loader2, ShoppingBag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCart } from "@/context/CartContext";
import { supabase } from "@/lib/supabase";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 0,
});

type ShippingForm = {
  fullName: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
};

type PaymentMethod = "cash_on_delivery" | "card_demo";

export default function CheckoutPage() {
  const router = useRouter();
  const { items, totalPrice, clearCart } = useCart();
  const [userId, setUserId] = useState<string | null>(null);
  const [form, setForm] = useState<ShippingForm>({
    fullName: "",
    phone: "",
    address: "",
    city: "",
    postalCode: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [orderId, setOrderId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card_demo");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }: any) => {
      setUserId(data.session?.user?.id ?? null);
    });
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!userId) {
      setError("Please sign in before placing your order.");
      return;
    }
    if (items.length === 0) {
      setError("Your cart is empty.");
      return;
    }

    if (paymentMethod === "card_demo" && cardNumber.replace(/\s/g, "").endsWith("0002")) {
      setError("Demo payment declined. Try another test card number.");
      return;
    }

    setSubmitting(true);
    if (paymentMethod === "card_demo") {
      await new Promise((resolve) => setTimeout(resolve, 1200));
    }

    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        id: userId,
        full_name: form.fullName,
      },
      { onConflict: "id" }
    );

    if (profileError) {
      setError("We could not prepare your customer profile. Please sign out and sign in again.");
      setSubmitting(false);
      return;
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: userId,
        total: totalPrice,
        status: "pending",
        shipping_address: form,
        payment_method: paymentMethod,
      })
      .select("id")
      .single();

    if (orderError || !order) {
      setError(orderError?.message ?? "We could not create your order. Please try again.");
      setSubmitting(false);
      return;
    }

    const { error: itemsError } = await supabase.from("order_items").insert(
      items.map((item) => ({
        order_id: order.id,
        product_id: item.id,
        quantity: item.quantity,
        unit_price: item.price,
      }))
    );

    if (itemsError) {
      setError(itemsError.message);
      setSubmitting(false);
      return;
    }

    clearCart();
    setOrderId(order.id);
    setSubmitting(false);
  }

  if (orderId) {
    return (
      <main className="min-h-screen bg-white px-6 py-24 md:px-12">
        <div className="mx-auto max-w-xl text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-black text-white">
            <Check size={24} strokeWidth={1.5} />
          </div>
          <p className="mt-8 text-[10px] uppercase tracking-[0.4em] text-neutral-400">Order confirmed</p>
          <h1 className="mt-4 font-playfair text-4xl font-light text-neutral-900">Thank you for your order.</h1>
          <p className="mt-5 text-sm font-light leading-7 text-neutral-500">
            Your order has been received and will be prepared for delivery. We will contact you using the details provided.
          </p>
          <p className="mt-6 text-xs text-neutral-400">Order ID: {orderId}</p>
          <Link href="/" className="mt-10 inline-flex bg-black px-8 py-4 text-[10px] font-medium uppercase tracking-[0.25em] text-white transition-colors hover:bg-neutral-800">
            Continue shopping
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-50 px-6 py-12 md:px-12 md:py-20">
      <div className="mx-auto max-w-6xl">
        <Link href="/" className="inline-flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-neutral-500 transition-colors hover:text-black">
          <ArrowLeft size={14} strokeWidth={1.5} /> Continue shopping
        </Link>
        <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_380px]">
          <section>
            <p className="text-[10px] uppercase tracking-[0.4em] text-neutral-400">Checkout</p>
            <h1 className="mt-3 font-playfair text-4xl font-light text-neutral-900">Complete your order</h1>
            <p className="mt-3 text-sm font-light text-neutral-500">Demo checkout. No real payment will be charged.</p>

            {!userId && (
              <div className="mt-8 border border-neutral-200 bg-white p-5 text-sm text-neutral-600">
                Please sign in from the account menu before placing an order.
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-10 space-y-8 bg-white p-6 md:p-10">
              <div className="grid gap-7 md:grid-cols-2">
                <label className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                  Full name
                  <input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className="mt-3 w-full border-b border-neutral-200 px-0 py-3 text-sm normal-case tracking-normal text-neutral-900 outline-none focus:border-black" />
                </label>
                <label className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                  Phone
                  <input required type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="mt-3 w-full border-b border-neutral-200 px-0 py-3 text-sm normal-case tracking-normal text-neutral-900 outline-none focus:border-black" />
                </label>
              </div>
              <label className="block text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                Address
                <textarea required rows={3} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="mt-3 w-full resize-none border-b border-neutral-200 px-0 py-3 text-sm normal-case tracking-normal text-neutral-900 outline-none focus:border-black" />
              </label>
              <div className="grid gap-7 md:grid-cols-2">
                <label className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                  City
                  <input required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="mt-3 w-full border-b border-neutral-200 px-0 py-3 text-sm normal-case tracking-normal text-neutral-900 outline-none focus:border-black" />
                </label>
                <label className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                  Postal code
                  <input required inputMode="numeric" value={form.postalCode} onChange={(e) => setForm({ ...form, postalCode: e.target.value })} className="mt-3 w-full border-b border-neutral-200 px-0 py-3 text-sm normal-case tracking-normal text-neutral-900 outline-none focus:border-black" />
                </label>
              </div>
              <fieldset className="border-t border-neutral-100 pt-8">
                <legend className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">Payment method</legend>
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <label className={`cursor-pointer border p-4 text-sm transition-colors ${paymentMethod === "card_demo" ? "border-black" : "border-neutral-200"}`}>
                    <input type="radio" name="payment" value="card_demo" checked={paymentMethod === "card_demo"} onChange={() => setPaymentMethod("card_demo")} className="sr-only" />
                    <span className="block font-medium">Demo card</span>
                    <span className="mt-1 block text-xs font-light text-neutral-400">Simulated approval or decline</span>
                  </label>
                  <label className={`cursor-pointer border p-4 text-sm transition-colors ${paymentMethod === "cash_on_delivery" ? "border-black" : "border-neutral-200"}`}>
                    <input type="radio" name="payment" value="cash_on_delivery" checked={paymentMethod === "cash_on_delivery"} onChange={() => setPaymentMethod("cash_on_delivery")} className="sr-only" />
                    <span className="block font-medium">Cash on delivery</span>
                    <span className="mt-1 block text-xs font-light text-neutral-400">Pay when your order arrives</span>
                  </label>
                </div>
                {paymentMethod === "card_demo" && (
                  <div className="mt-6 space-y-6 border border-neutral-100 bg-neutral-50 p-5">
                    <p className="text-xs leading-5 text-neutral-500">Use a fictional card for this demo. Try <strong className="font-medium text-neutral-800">4242 4242 4242 4242</strong> for success or a number ending in <strong className="font-medium text-neutral-800">0002</strong> for a declined payment.</p>
                    <label className="block text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                      Card number
                      <input required inputMode="numeric" autoComplete="off" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} placeholder="4242 4242 4242 4242" className="mt-3 w-full border-b border-neutral-200 bg-transparent px-0 py-3 text-sm normal-case tracking-normal text-neutral-900 outline-none focus:border-black" />
                    </label>
                    <div className="grid gap-6 md:grid-cols-2">
                      <label className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                        Expiry
                        <input required inputMode="numeric" autoComplete="off" value={cardExpiry} onChange={(e) => setCardExpiry(e.target.value)} placeholder="MM / YY" className="mt-3 w-full border-b border-neutral-200 bg-transparent px-0 py-3 text-sm normal-case tracking-normal text-neutral-900 outline-none focus:border-black" />
                      </label>
                      <label className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                        CVC
                        <input required inputMode="numeric" autoComplete="off" value={cardCvc} onChange={(e) => setCardCvc(e.target.value)} placeholder="123" className="mt-3 w-full border-b border-neutral-200 bg-transparent px-0 py-3 text-sm normal-case tracking-normal text-neutral-900 outline-none focus:border-black" />
                      </label>
                    </div>
                  </div>
                )}
              </fieldset>
              {error && <p className="border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</p>}
              <button type="submit" disabled={submitting || !userId || items.length === 0} className="flex w-full items-center justify-center gap-2 bg-black py-4 text-[10px] font-medium uppercase tracking-[0.25em] text-white transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300">
                {submitting && <Loader2 size={14} className="animate-spin" />}
                {paymentMethod === "card_demo" ? "Simulate payment" : "Place order"}
              </button>
            </form>
          </section>

          <aside className="h-fit bg-white p-6 md:p-8">
            <div className="flex items-center gap-3 border-b border-neutral-100 pb-5">
              <ShoppingBag size={17} strokeWidth={1.5} />
              <h2 className="text-[11px] uppercase tracking-[0.25em]">Order summary</h2>
            </div>
            <div className="divide-y divide-neutral-100">
              {items.map((item) => (
                <div key={`${item.id}-${item.size}`} className="flex justify-between gap-4 py-5 text-sm">
                  <div>
                    <p className="font-playfair text-base text-neutral-900">{item.name}</p>
                    <p className="mt-1 text-xs text-neutral-400">{item.size ? `Size ${item.size} · ` : ""}Qty {item.quantity}</p>
                  </div>
                  <span className="whitespace-nowrap text-sm">{currency.format(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
            {items.length === 0 && <p className="py-8 text-center text-sm font-light text-neutral-400">Your cart is empty.</p>}
            <div className="mt-3 flex items-center justify-between border-t border-neutral-200 pt-5 text-sm font-medium">
              <span>Total</span>
              <span>{currency.format(totalPrice)}</span>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
