import type { Metadata } from "next";
import { getCategoryBySlug } from "@/lib/categories";
import { findProductByIdOrSlug } from "@/lib/supabase";

export async function productRouteMetadata(category: string, slug: string): Promise<Metadata> {
  const normalized = decodeURIComponent(slug).toLowerCase().trim();
  const collection = getCategoryBySlug(category, normalized);
  if (collection) return {
    title: `${category === "women" ? "Women" : "Men"} · ${collection.name}`,
    description: `Explore the ${collection.name} collection in the zeouf portfolio demo. Orders and payments are simulated.`,
  };
  const product = await findProductByIdOrSlug(normalized);
  if (!product) return { title: "Product unavailable", robots: { index: false, follow: false } };
  const title = `${product.name} · ${product.category}`;
  const description = `Explore ${product.name} in ${product.category} at zeouf. View product details and demo availability. Portfolio demo: no payment is charged and no products are shipped.`;
  return {
    title,
    description,
    openGraph: {
      type: "website", title: `${title} | zeouf`, description,
      images: product.image_url ? [{ url: product.image_url, alt: product.name }] : [],
    },
  };
}
