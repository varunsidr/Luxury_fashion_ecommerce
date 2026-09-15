import { supabase, findProductByIdOrSlug } from "@/lib/supabase";
import ProductDetailView from "@/components/ProductDetailView";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function ParfumSlugPage({ params }: PageProps) {
  const { slug } = await params;
  const normalizedSlug = decodeURIComponent(slug).toLowerCase().trim();

  // 1. Check as product ID first (support UUIDs by querying directly)
  const product = await findProductByIdOrSlug(normalizedSlug);
  if (product) return <ProductDetailView product={product} mainCategory="Perfume" />;

  notFound();
}
