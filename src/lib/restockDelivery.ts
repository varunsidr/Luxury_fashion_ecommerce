import type { SupabaseClient } from "@supabase/supabase-js";
import { getStorefrontSlugForCategory } from "@/lib/categories";

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!);
type Claim = {
  id: string; product_id: string; email: string; size: string | null; color: string | null;
  unsubscribe_token: string; claim_token: string; product_name: string; category: string;
};
export type RestockMailConfig = { key: string; from: string; siteUrl: string };

export async function deliverRestockBatch(
  admin: Pick<SupabaseClient, "rpc">, config: RestockMailConfig, productId: string | null = null, send: typeof fetch = fetch,
) {
  const { data, error } = await admin.rpc("claim_restock_notifications", { p_product_id: productId, p_limit: 10 });
  if (error) throw new Error("Could not claim alerts. Check the restock delivery migration.");
  let sent = 0, failed = 0, skipped = 0;
  for (const notification of (data ?? []) as Claim[]) {
    const siteUrl = config.siteUrl.replace(/\/$/, "");
    const productUrl = `${siteUrl}/${getStorefrontSlugForCategory(notification.category)}/${notification.product_id}`;
    const unsubscribeUrl = `${siteUrl}/api/restock-notifications/unsubscribe?token=${notification.unsubscribe_token}`;
    const option = [notification.size && `Size ${notification.size}`, notification.color].filter(Boolean).join(" · ");
    const payload = {
      from: config.from, to: [notification.email], subject: `${notification.product_name} is back in stock`,
      html: `<div style="font-family:Arial,sans-serif;color:#171717;max-width:560px;margin:32px auto"><p>zeouf</p><h1>It's back.</h1><p>${escapeHtml(notification.product_name)}${option ? ` · ${escapeHtml(option)}` : ""} is available again. Availability may change before checkout.</p><p><a href="${escapeHtml(productUrl)}">Shop now</a></p><p><a href="${escapeHtml(unsubscribeUrl)}">Unsubscribe from this alert</a></p></div>`,
      headers: { "List-Unsubscribe": `<${unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    };
    // Freeze the payload so retries retain the same provider idempotency input.
    const prepared = await admin.rpc("prepare_restock_delivery", { p_id: notification.id, p_claim: notification.claim_token, p_payload: payload });
    if (prepared.error) { failed++; continue; } // The lease recovers DB failures.
    let success = false, retryable = true, failure = "NO_LONGER_ELIGIBLE";
    if (prepared.data) {
      try {
        const response = await send("https://api.resend.com/emails", {
          method: "POST", signal: AbortSignal.timeout(8000),
          headers: { Authorization: `Bearer ${config.key}`, "Content-Type": "application/json", "Idempotency-Key": `restock/${notification.id}` },
          body: JSON.stringify(prepared.data),
        });
        success = response.ok;
        failure = `PROVIDER_${response.status}`;
        retryable = response.status >= 500 || [408,409,425,429].includes(response.status);
        if (response.status === 409) {
          const problem = await response.json().catch(() => null);
          if (problem?.name === "invalid_idempotent_request") retryable = false;
        }
      } catch { failure = "PROVIDER_UNCONFIRMED"; }
    } else skipped++;
    const finished = await admin.rpc("finish_restock_delivery", {
      p_id: notification.id, p_claim: notification.claim_token, p_success: success, p_error: failure, p_retryable: retryable,
    });
    if (finished.error || !finished.data) failed++;
    else if (success) sent++;
    else if (prepared.data) failed++;
  }
  return { status: "processed", sent, failed, skipped, claimed: (data ?? []).length, configured: true };
}
