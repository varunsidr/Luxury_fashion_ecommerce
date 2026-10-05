import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyToken } from "@/lib/adminAuth";
import { getStorefrontSlugForCategory } from "@/lib/categories";

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);

export async function POST(request: Request) {
  const token = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith("admin_token="))?.slice("admin_token=".length);
  if (!verifyToken(token ?? "")) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { productId, size } = await request.json().catch(() => ({}));
  if (typeof productId !== "string" || !/^[0-9a-f-]{36}$/i.test(productId)) return NextResponse.json({ error: "Invalid product." }, { status: 400 });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESTOCK_FROM_EMAIL;
  if (!supabaseUrl || !serviceRoleKey) return NextResponse.json({ error: "Restock alerts are not configured." }, { status: 503 });
  if (!resendKey || !fromEmail) return NextResponse.json({ status: "queued", sent: 0, configured: false });

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });
  const { data: product, error: productError } = await admin.from("products").select("name, category").eq("id", productId).maybeSingle();
  if (productError || !product) return NextResponse.json({ error: "Product not found." }, { status: 404 });

  const query = admin.from("restock_notifications").select("id, email, size, color, unsubscribe_token").eq("product_id", productId).is("notified_at", null);
  const { data: notifications, error } = await query.limit(100);
  if (error) return NextResponse.json({ error: "Could not load restock requests." }, { status: 503 });

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  const productUrl = `${siteUrl}/${getStorefrontSlugForCategory(product.category ?? "")}/${productId}`;
  const productName = escapeHtml(product.name);
  let sent = 0;
  const matchingNotifications = (notifications ?? []).filter((notification) =>
    !notification.size || !size || notification.size === String(size).trim()
  );
  for (const notification of matchingNotifications) {
    const option = [notification.size && `Size ${escapeHtml(notification.size)}`, notification.color && escapeHtml(notification.color)].filter(Boolean).join(" · ");
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: fromEmail,
        to: [notification.email],
        subject: `${product.name} is back in stock`,
        html: `<div style="font-family:Arial,sans-serif;color:#171717;max-width:560px;margin:32px auto"><p style="letter-spacing:.25em;text-transform:uppercase;color:#777;font-size:11px">zeouf</p><h1 style="font-size:24px;font-weight:400">It's back.</h1><p>${productName}${option ? ` · ${option}` : ""} is available again.</p><p><a href="${productUrl}" style="display:inline-block;background:#171717;color:#fff;padding:14px 22px;text-decoration:none">Shop now</a></p><p style="margin-top:36px;font-size:12px;color:#777"><a href="${siteUrl}/api/restock-notifications/unsubscribe?token=${notification.unsubscribe_token}">Unsubscribe from this alert</a></p></div>`,
        headers: { "List-Unsubscribe": `<${siteUrl}/api/restock-notifications/unsubscribe?token=${notification.unsubscribe_token}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      }),
    });
    if (!response.ok) continue;
    const { error: markError } = await admin.from("restock_notifications").update({ notified_at: new Date().toISOString() }).eq("id", notification.id).is("notified_at", null);
    if (!markError) sent++;
  }
  return NextResponse.json({ status: "processed", sent, configured: true });
}
