import { supabase, findProductByIdOrSlug } from "@/lib/supabase";
import ProductListing from "@/components/ProductListing";
import ProductDetailView from "@/components/ProductDetailView";
import { notFound } from "next/navigation";
import { getCategoryBySlug } from "@/lib/categories";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function ErkekSlugPage({ params }: PageProps) {
  const { slug } = await params;
  const normalizedSlug = decodeURIComponent(slug).toLowerCase().trim();

  // 1. Kategori mi diye kontrol et (Merkezi kütüphaneden)
  const categoryDef = getCategoryBySlug("men", normalizedSlug) ?? getCategoryBySlug("erkek", normalizedSlug);
  
  if (categoryDef) {
    return (
      <ProductListing 
        mainCategory="Men" 
        subCategory={categoryDef.name} 
        subCategorySlug={normalizedSlug}
      />
    );
  }

  // 2. Use findProductByIdOrSlug helper
  const product = await findProductByIdOrSlug(normalizedSlug);
  if (product) return <ProductDetailView product={product} mainCategory="Men" />;

  // 3. Hiçbiri değilse 404
  notFound();
}
