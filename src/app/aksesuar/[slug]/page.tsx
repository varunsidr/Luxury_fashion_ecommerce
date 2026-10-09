import { productRouteMetadata } from '@/lib/productMetadata';
import { supabase, findProductByIdOrSlug } from "@/lib/supabase";
import ProductDetailView from "@/components/ProductDetailView";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  return productRouteMetadata('accessories', slug);
}

export default async function AksesuarSlugPage({ params }: PageProps) {
  const { slug } = await params;
  const normalizedSlug = decodeURIComponent(slug).toLowerCase().trim();

  const product = await findProductByIdOrSlug(normalizedSlug);

  if (product) return <ProductDetailView product={product} mainCategory="Accessories" />;

  notFound();
}
