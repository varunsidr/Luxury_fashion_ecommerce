import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { deliverRestockBatch } from "@/lib/restockDelivery";

export async function processRestockAlerts(productId: string | null = null) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return NextResponse.json({ error: "Restock alerts are not configured." }, { status: 503 });
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESTOCK_FROM_EMAIL;
  if (!key || !from) return NextResponse.json({ status: "queued", sent: 0, configured: false });
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl || !/^https?:\/\//.test(siteUrl)) return NextResponse.json({ error: "Configure the public site URL before sending alerts." }, { status: 503 });
  try {
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    return NextResponse.json(await deliverRestockBatch(admin, { key, from, siteUrl }, productId));
  } catch {
    return NextResponse.json({ error: "Could not process alerts. Requests remain queued; check the restock delivery migration and retry." }, { status: 503 });
  }
}
