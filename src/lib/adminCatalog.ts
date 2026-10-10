import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { verifyToken } from "./adminAuth";
import { isRateLimited } from "./rateLimit";

export const PRODUCT_CATEGORIES = ["Women's Dress", "Women's Blouse & Shirt", "Women's Jacket", "Women's Skirt", "Women's Trousers", "Men's Suit", "Men's Shirt", "Men's Trousers", "Men's Jacket", "Shoes", "Bags", "Accessories", "Perfume", "Makeup"];
export const PRODUCT_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "36", "37", "38", "39", "40", "41", "42", "43", "44"];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export interface ProductInput {
  name: string; category: string; price: number; stock: number;
  description: string; sizes: string[]; image_url: string; images: string[];
}
export interface AdminCatalogDeps {
  authorize(request: Request): string | null;
  rateLimit(key: string, limit: number): Promise<boolean | null>;
  store: (() => {
    list(): Promise<unknown[]>;
    save(id: string | null, product: ProductInput): Promise<unknown>;
    remove(id: string): Promise<boolean>;
    upload(file: File, bytes: Buffer): Promise<string>;
  } | null);
}

function validImage(value: string): boolean {
  if (!value) return true;
  if (value.length > 2000 || /[\\\s]/.test(value)) return false;
  if (value.startsWith("/") && !value.startsWith("//")) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && url.origin === new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch { return false; }
}

export function validateProduct(value: unknown): ProductInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const p = value as Record<string, unknown>;
  if (typeof p.name !== "string" || !p.name.trim() || p.name.trim().length > 200 ||
      typeof p.category !== "string" || !PRODUCT_CATEGORIES.includes(p.category) ||
      typeof p.price !== "number" || !Number.isFinite(p.price) || p.price < 0 || p.price >= 10_000_000_000 || Math.round(p.price * 100) / 100 !== p.price ||
      typeof p.stock !== "number" || !Number.isInteger(p.stock) || p.stock < 0 || p.stock > 2147483647 ||
      typeof p.description !== "string" || p.description.length > 10000 ||
      !Array.isArray(p.sizes) || p.sizes.length > PRODUCT_SIZES.length || p.sizes.some(s => typeof s !== "string" || !PRODUCT_SIZES.includes(s)) || new Set(p.sizes).size !== p.sizes.length ||
      typeof p.image_url !== "string" || !validImage(p.image_url) ||
      !Array.isArray(p.images) || p.images.length > 12 || p.images.some(s => typeof s !== "string" || !s || !validImage(s))) return null;
  return { name: p.name.trim(), category: p.category, price: p.price, stock: p.stock,
    description: p.description, sizes: p.sizes, image_url: p.image_url, images: p.images } as ProductInput;
}

async function guard(request: Request, deps: AdminCatalogDeps, mutation: boolean, limit = 60) {
  const adminId = deps.authorize(request);
  if (!adminId) return json({ error: "Unauthorized." }, 401);
  if (mutation) {
    const origin = request.headers.get("origin");
    if (request.headers.get("sec-fetch-site") === "cross-site" || (origin && origin !== new URL(request.url).origin)) return json({ error: "Invalid request origin." }, 403);
    const limited = await deps.rateLimit(`admin-catalog:${adminId}:${limit}`, limit);
    if (limited === null) return json({ error: "Catalog management is temporarily unavailable." }, 503);
    if (limited) return json({ error: "Too many changes. Please wait a moment." }, 429);
  }
  return null;
}

export async function handleCatalog(request: Request, id: string | null, deps = adminCatalogDeps): Promise<Response> {
  const method = request.method;
  const denied = await guard(request, deps, method !== "GET");
  if (denied) return denied;
  if (id !== null && !uuid.test(id)) return json({ error: "Invalid product ID." }, 400);
  let product: ProductInput | null = null;
  if (method === "POST" || method === "PATCH") {
    if (!request.headers.get("content-type")?.includes("application/json")) return json({ error: "Send a JSON product." }, 400);
    const text = await request.text();
    if (text.length > 50000) return json({ error: "Product is too large." }, 413);
    try { product = validateProduct(JSON.parse(text)); } catch { /* Invalid JSON. */ }
    if (!product) return json({ error: "Check the name, category, price, stock, sizes and image URLs. Prices need at most two decimals; stock must be a nonnegative whole number." }, 400);
  }
  const store = deps.store();
  if (!store) return json({ error: "Catalog management is not configured." }, 503);
  try {
    if (method === "GET") return json({ products: await store.list() });
    if (method === "DELETE") return await store.remove(id!) ? json({ status: "ok" }) : json({ error: "Product not found." }, 404);
    return json({ product: await store.save(id, product!) }, method === "POST" ? 201 : 200);
  } catch (error) {
    if (error instanceof Error && error.message.includes("PRODUCT_NOT_FOUND")) return json({ error: "Product not found." }, 404);
    return json({ error: "Could not save catalog changes. Check the admin catalog migration and configuration, then retry." }, 503);
  }
}

export function matchesProductImage(bytes: Buffer, type: string) {
  if (type === "image/jpeg") return bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  if (type === "image/png") return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  return type === "image/webp" && bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
}

export async function handleProductUpload(request: Request, deps = adminCatalogDeps): Promise<Response> {
  const denied = await guard(request, deps, true, 10);
  if (denied) return denied;
  if (Number(request.headers.get("content-length")) > 3 * 1024 * 1024) return json({ error: "Upload is too large." }, 413);
  try {
    const form = await request.formData();
    const file = form.get("image");
    if (!(file instanceof File) || form.getAll("image").length !== 1 || file.size < 1 || file.size > 2 * 1024 * 1024) return json({ error: "Choose one JPEG, PNG or WebP image up to 2 MiB." }, 400);
    const bytes = Buffer.from(await file.arrayBuffer());
    if (!matchesProductImage(bytes, file.type)) return json({ error: "Image content does not match JPEG, PNG or WebP format." }, 400);
    const store = deps.store();
    if (!store) return json({ error: "Image storage is not configured." }, 503);
    return json({ url: await store.upload(file, bytes) }, 201);
  } catch { return json({ error: "Could not upload the image. Please retry." }, 503); }
}

export const adminCatalogDeps: AdminCatalogDeps = {
  authorize: request => {
    const token = request.headers.get("cookie")?.split(";").map(p => p.trim()).find(p => p.startsWith("admin_token="))?.slice(12);
    return verifyToken(token ?? "")?.adminId ?? null;
  },
  rateLimit: (key, limit) => isRateLimited(key, limit, 60_000),
  store: () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    const client = createClient(url, key, { auth: { persistSession: false } });
    return {
      list: async () => {
        const { data, error } = await client.from("products").select("*, product_size_stock(id,product_id,size,stock)").order("created_at", { ascending: false });
        if (error) throw new Error("CATALOG_UNAVAILABLE");
        return data ?? [];
      },
      save: async (id, product) => {
        const { data, error } = await client.rpc("save_admin_product", { p_product_id: id, p_product: product });
        if (error) throw new Error(error.message);
        return data;
      },
      remove: async id => {
        const { data, error } = await client.from("products").delete().eq("id", id).select("id");
        if (error) throw new Error("DELETE_FAILED");
        return Boolean(data?.length);
      },
      upload: async (file, bytes) => {
        const ext = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as Record<string, string>)[file.type];
        const path = `admin/${randomUUID()}.${ext}`;
        const { error } = await client.storage.from("product-images").upload(path, bytes, { contentType: file.type, upsert: false });
        if (error) throw new Error("UPLOAD_FAILED");
        return client.storage.from("product-images").getPublicUrl(path).data.publicUrl;
      },
    };
  },
};
