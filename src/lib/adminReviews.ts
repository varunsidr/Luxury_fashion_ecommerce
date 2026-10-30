import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { adminCatalogDeps } from "./adminCatalog";
import { isRateLimited } from "./rateLimit";
import { reviewImageUrls } from "./reviewImages";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
export type ReviewChange = { approved?: boolean; admin_reply?: string | null; replied_at?: string | null; moderated_at?: string; moderated_by?: string };
export interface AdminReviewDeps {
  authorize(request: Request): string | null;
  rateLimit(key: string): Promise<boolean | null>;
  store(): null | {
    list(status: string): Promise<unknown[]>;
    update(id: string, change: ReviewChange): Promise<unknown | null>;
    remove(id: string): Promise<boolean>;
  };
}

export async function handleAdminReviews(request: Request, id: string | null, deps = adminReviewDeps, override?: "PUT" | "DELETE"): Promise<Response> {
  const adminId = deps.authorize(request);
  if (!adminId) return json({ error: "Unauthorized." }, 401);
  const method = override ?? request.method;
  if (!["GET", "PUT", "PATCH", "DELETE"].includes(method)) return json({ error: "Method not allowed." }, 405);
  if (id !== null && !uuid.test(id)) return json({ error: "Invalid review ID." }, 400);
  if (method !== "GET") {
    if (!id) return json({ error: "Review ID required." }, 400);
    const origin = request.headers.get("origin");
    if (request.headers.get("sec-fetch-site") === "cross-site" || origin && origin !== new URL(request.url).origin) return json({ error: "Invalid request origin." }, 403);
    const limited = await deps.rateLimit(`admin-reviews:${adminId}`);
    if (limited === null) return json({ error: "Review management is temporarily unavailable." }, 503);
    if (limited) return json({ error: "Too many changes. Please wait a moment." }, 429);
  }
  const status = new URL(request.url).searchParams.get("status") ?? "pending";
  if (method === "GET" && !["all", "pending", "approved"].includes(status)) return json({ error: "Invalid review status." }, 400);
  const change: ReviewChange = {};
  if (method === "PUT") change.approved = true;
  if (method === "PATCH") {
    const text = await request.text();
    if (text.length > 12000) return json({ error: "Review update is too large." }, 413);
    let body: Record<string, unknown>;
    try { body = JSON.parse(text); } catch { return json({ error: "Send a valid review update." }, 400); }
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).some(key => !["approved", "reply"].includes(key)) || !Object.keys(body).length) return json({ error: "Send approval or reply fields only." }, 400);
    if ("approved" in body) {
      if (typeof body.approved !== "boolean") return json({ error: "Approval must be true or false." }, 400);
      change.approved = body.approved;
    }
    if ("reply" in body) {
      if (body.reply !== null && (typeof body.reply !== "string" || body.reply.trim().length > 2000 || !body.reply.trim())) return json({ error: "Write a reply of 1 to 2000 characters, or remove the reply." }, 400);
      change.admin_reply = body.reply === null ? null : (body.reply as string).trim();
      change.replied_at = change.admin_reply === null ? null : new Date().toISOString();
    }
  }
  if (change.approved !== undefined) { change.moderated_by = adminId; change.moderated_at = new Date().toISOString(); }
  try {
    const store = deps.store();
    if (!store) return json({ error: "Review management is not configured." }, 503);
    if (method === "GET") return json({ reviews: await store.list(status) });
    if (method === "DELETE") return await store.remove(id!) ? json({ status: "ok" }) : json({ error: "Review not found." }, 404);
    const review = await store.update(id!, change);
    return review ? json({ review }) : json({ error: "Review not found." }, 404);
  } catch { return json({ error: "Could not save review changes. Check the review migration and connection, then retry." }, 503); }
}

export const adminReviewDeps: AdminReviewDeps = {
  authorize: adminCatalogDeps.authorize,
  rateLimit: key => isRateLimited(key, 60, 60_000),
  store() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    const client = createClient(url, key, { auth: { persistSession: false } });
    async function attachImages(review: Record<string, unknown>) {
      return { ...review, displayImages: await reviewImageUrls(client, { product_id: review.product_id, user_id: review.user_id, images: review.images }) };
    }
    return {
      async list(status) {
        let query = client.from("reviews").select("*").order("created_at", { ascending: false }).limit(200);
        if (status !== "all") query = query.eq("approved", status === "approved");
        const { data, error } = await query;
        if (error) throw error;
        return Promise.all((data ?? []).map(attachImages));
      },
      async update(id, change) {
        const { data, error } = await client.from("reviews").update(change).eq("id", id).select("*").maybeSingle();
        if (error) throw error;
        return data ? attachImages(data) : null;
      },
      async remove(id) {
        const { data, error } = await client.from("reviews").delete().eq("id", id).select("id");
        if (error) throw error;
        return Boolean(data?.length);
      },
    };
  },
};
