import type { SupabaseClient } from "@supabase/supabase-js";
import type { Product } from "@/lib/productTypes";
import { productBelongsToRoute } from "@/lib/categories";

export async function lookupProduct(value: string, category: string | undefined, deps: {
  configured: boolean;
  client: SupabaseClient;
  local: (Product & { slug?: string })[];
  timeoutMs?: number;
}): Promise<Product | null> {
  const normalized = value.toLowerCase().trim();
  const accept = (product: Product | null) => product && (!category || productBelongsToRoute(product.category, category)) ? product : null;
  if (!deps.configured) {
    return accept(deps.local.find(product => String(product.id).toLowerCase() === normalized || product.slug?.toLowerCase() === normalized) ?? null);
  }

  // Bound the whole operation, including providers that fail to honor abort.
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("Product lookup timed out. Please retry."));
    }, deps.timeoutMs ?? 8_000);
  });
  try {
    return await Promise.race([deadline, (async () => {
      const field = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(normalized) ? "id" : "slug";
      const { data, error } = await deps.client.from("products").select("*").eq(field, normalized).abortSignal(controller.signal).maybeSingle();
      // The base schema has no slug column. UUID links still work; an unknown
      // slug in that schema is absent, rather than a reason to scan the catalog.
      if (error && !(field === "slug" && ["42703", "PGRST204"].includes(error.code))) {
        throw new Error("Could not load this product. Please retry.");
      }
      return accept(data as Product | null);
    })()]);
  } finally {
    clearTimeout(timer);
  }
}
