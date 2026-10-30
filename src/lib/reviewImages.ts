import type { SupabaseClient } from "@supabase/supabase-js";

export async function reviewImageUrls(client: SupabaseClient, review: { product_id: unknown; user_id?: unknown; images?: unknown }) {
  if (!Array.isArray(review.images)) return [];
  const paths = review.images.slice(0, 3).filter((source): source is string => typeof source === "string");
  const prefix = `reviews/${review.product_id}/${review.user_id}/`;
  const urls = await Promise.all(paths.map(async source => {
    if (!source.startsWith(prefix) || !/^[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(source.slice(prefix.length))) return null;
    const { data, error } = await client.storage.from("review-images").createSignedUrl(source, 600);
    return error ? null : data?.signedUrl ?? null;
  }));
  return urls.filter((source): source is string => Boolean(source));
}
