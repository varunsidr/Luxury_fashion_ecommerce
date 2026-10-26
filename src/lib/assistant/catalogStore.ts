import { supabase } from "../supabase";
import { catalogRequest } from "../catalogRequest";
import type { Product, ProductSizeStock } from "../productTypes";
import type { CatalogStore } from "./types";

const CACHE_MS = 30_000;
let cache: { at: number; products: Product[] } | null = null;
let inflight: Promise<Product[]> | null = null;

type Rows<T> = { data: T[] | null; error: unknown };

/** Read-only catalog via the storefront's existing Supabase client (public RLS read policy). */
export const supabaseCatalogStore: CatalogStore = {
  listProducts(options) {
    // A request-owned query can be cancelled without cancelling another shopper's shared load.
    if (options?.signal) return options.fresh ? loadProducts(false, options.signal)
      : cache && Date.now() - cache.at < CACHE_MS ? Promise.resolve(cache.products) : loadProducts(true, options.signal);
    if (options?.fresh) return loadProducts(false);
    if (cache && Date.now() - cache.at < CACHE_MS) return Promise.resolve(cache.products);
    inflight ??= loadProducts().finally(() => { inflight = null; });
    return inflight;
  },
};

async function loadProducts(updateCache = true, signal = new AbortController().signal): Promise<Product[]> {
  // catalogRequest bounds the wait; the local fallback client has no abortSignal().
  const [productResult, stockResult] = await Promise.all([
    catalogRequest<Rows<Product>>((abort) => {
      const query = supabase.from("products").select("*");
      return typeof query.abortSignal === "function" ? query.abortSignal(abort) : query;
    }, signal),
    catalogRequest<Rows<ProductSizeStock>>((abort) => {
      const query = supabase.from("product_size_stock").select("product_id,size,stock");
      return typeof query.abortSignal === "function" ? query.abortSignal(abort) : query;
    }, signal),
  ]);
  if (productResult.error || !productResult.data || stockResult.error || !stockResult.data) throw new Error("Catalog unavailable");
  const stockByProduct = new Map<string, ProductSizeStock[]>();
  for (const row of stockResult.data ?? []) {
    const key = String(row.product_id);
    stockByProduct.set(key, [...(stockByProduct.get(key) ?? []), { size: row.size, stock: Number(row.stock ?? 0) }]);
  }
  const products = productResult.data.map((product) => ({
    ...product,
    id: String(product.id),
    size_stock: stockByProduct.get(String(product.id)) ?? [],
  }));
  if (updateCache) cache = { at: Date.now(), products };
  return products;
}
