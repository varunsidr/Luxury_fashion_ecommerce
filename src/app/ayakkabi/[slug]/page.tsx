import { supabase, findProductByIdOrSlug } from "@/lib/supabase";
import ProductListing from "@/components/ProductListing";
import ProductDetailView from "@/components/ProductDetailView";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function AyakkabiSlugPage({ params }: PageProps) {
  const { slug } = await params;
  const normalizedSlug = decodeURIComponent(slug).toLowerCase().trim();

  // 1. Check as product ID first (support UUIDs by querying directly)
  const product = await findProductByIdOrSlug(normalizedSlug);
  if (product) return <ProductDetailView product={product} mainCategory="Shoes" />;

  // 2. Subcategory support can be added later; for now return 404 if not an ID
  notFound();
}
