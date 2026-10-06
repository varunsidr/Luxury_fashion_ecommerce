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
  listProducts() {
    if (cache && Date.now() - cache.at < CACHE_MS) return Promise.resolve(cache.products);
    inflight ??= loadProducts().finally(() => { inflight = null; });
    return inflight;
  },
};

async function loadProducts(): Promise<Product[]> {
  // catalogRequest bounds the wait; the local fallback client has no abortSignal().
  const signal = new AbortController().signal;
  const [productResult, stockResult] = await Promise.all([
    catalogRequest<Rows<Product>>(() => supabase.from("products").select("*"), signal),
    catalogRequest<Rows<ProductSizeStock>>(() => supabase.from("product_size_stock").select("product_id,size,stock"), signal)
      .catch(() => ({ data: [] as ProductSizeStock[], error: null })),
  ]);
  if (productResult.error || !productResult.data) throw new Error("Catalog unavailable");
  const stockByProduct = new Map<string, ProductSizeStock[]>();
  for (const row of stockResult.data ?? []) {
    const key = String(row.product_id);
    stockByProduct.set(key, [...(stockByProduct.get(key) ?? []), { size: row.size, stock: Number(row.stock ?? 0) }]);
  }
  const products = productResult.data.map((product) => ({
    ...product,
    id: String(product.id),
    size_stock: stockByProduct.get(String(product.id)) ?? product.size_stock ?? [],
  }));
  cache = { at: Date.now(), products };
  return products;
}
