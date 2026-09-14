"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { localProducts } from "@/lib/localProducts";
import ProductCard from "@/components/ProductCard";
import { Loader2, ChevronRight } from "lucide-react";
import { getCategoryBySlug, CategoryDef } from "@/lib/categories";

interface ProductListingProps {
  mainCategory: string; // e.g., "Kadın", "Erkek", "Parfüm"
  subCategory?: string; // e.g., "Elbise", "Gömlek"
  subCategorySlug?: string;
}

export default function ProductListing({ mainCategory, subCategory, subCategorySlug }: ProductListingProps) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState("recommended");

  // Handle Turkish İ/ı vs I/i mapping for keys
  const mainCategoryKey = mainCategory.toLowerCase().replace(/ı/g, 'i');
  
  // Categorization Logic
  const isMainCategoryOnly = !subCategorySlug;
  const categoryDef = subCategorySlug ? getCategoryBySlug(mainCategoryKey, subCategorySlug) : undefined;
  
  const dbCategory = categoryDef ? categoryDef.dbCategory : mainCategory;
  const displayTitle = subCategory || mainCategory;
  const mainCategoryEnglishMap: Record<string, string> = {
    "Kadın": "Women",
    "Erkek": "Men",
    "Parfüm": "Perfume",
    "Ayakkabı": "Shoes",
    "Çanta": "Bags",
    "Aksesuar": "Accessories",
    "Makyaj": "Makeup",
  };
  const dataCategoryPrefix = mainCategoryEnglishMap[mainCategory] ?? mainCategory;
  const displayTitleText = categoryDef?.name ?? (mainCategoryEnglishMap[mainCategory] ?? displayTitle);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const useLocal = !isSupabaseConfigured || !supabase;
      if (useLocal) {
        const filtered = localProducts.filter((product) => {
          if (isMainCategoryOnly) {
            return product.category.startsWith(dataCategoryPrefix);
          }
          if (subCategorySlug === "yeni") {
            return product.category.startsWith(dataCategoryPrefix) && product.tag === "New";
          }
          if (subCategorySlug === "cok-satan") {
            return product.category.startsWith(dataCategoryPrefix) && product.tag === "Best Seller";
          }
          if (subCategorySlug === "koleksiyon") {
            return product.category.startsWith(dataCategoryPrefix);
          }
          return product.category === dbCategory;
        });
        setProducts(filtered);
        setLoading(false);
        return;
      }

      let query = supabase.from("products").select("*");

      if (isMainCategoryOnly) {
        query = query.ilike("category", `${dataCategoryPrefix}%`);
      } else if (subCategorySlug === "yeni") {
        query = query.ilike("category", `${dataCategoryPrefix}%`).eq("tag", "New");
      } else if (subCategorySlug === "cok-satan") {
        query = query.ilike("category", `${dataCategoryPrefix}%`).eq("tag", "Best Seller");
      } else if (subCategorySlug === "koleksiyon") {
        query = query.ilike("category", `${dataCategoryPrefix}%`);
      } else {
        query = query.eq("category", dbCategory);
      }

      const { data, error } = await query;

      if (error || !data) {
        console.warn("Supabase fetch failed, using local catalog fallback.", error);
        const filtered = localProducts.filter((product) => {
          if (isMainCategoryOnly) {
            return product.category.startsWith(dataCategoryPrefix);
          }
          if (subCategorySlug === "yeni") {
            return product.category.startsWith(dataCategoryPrefix) && product.tag === "New";
          }
          if (subCategorySlug === "cok-satan") {
            return product.category.startsWith(dataCategoryPrefix) && product.tag === "Best Seller";
          }
          if (subCategorySlug === "koleksiyon") {
            return product.category.startsWith(dataCategoryPrefix);
          }
          return product.category === dbCategory;
        });
        setProducts(filtered);
      } else {
        setProducts(data);
      }
    } catch (err) {
      console.error("Fetch error, falling back to local catalog:", err);
      const filtered = localProducts.filter((product) => {
        if (isMainCategoryOnly) {
          return product.category.startsWith(dataCategoryPrefix);
        }
        if (subCategorySlug === "yeni") {
          return product.category.startsWith(dataCategoryPrefix) && product.tag === "New";
        }
        if (subCategorySlug === "cok-satan") {
          return product.category.startsWith(dataCategoryPrefix) && product.tag === "Best Seller";
        }
        if (subCategorySlug === "koleksiyon") {
          return product.category.startsWith(dataCategoryPrefix);
        }
        return product.category === dbCategory;
      });
      setProducts(filtered);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [mainCategory, subCategorySlug, dbCategory, isMainCategoryOnly]);

  const getSortedProducts = () => {
    let sorted = [...products];
    if (sortBy === "price-low") {
      sorted.sort((a, b) => a.price - b.price);
    } else if (sortBy === "price-high") {
      sorted.sort((a, b) => b.price - a.price);
    } else if (sortBy === "newest") {
      sorted.sort((a, b) => (a.tag === "New" ? -1 : 1));
    }
    return sorted;
  };

  const sortedProducts = getSortedProducts();

  return (
    <main className="pt-[120px] md:pt-[140px] pb-20 bg-white min-h-screen">
      {/* Breadcrumbs & Header */}
      <div className="px-6 md:px-10 lg:px-16 mb-12">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col gap-2 mb-4">
             <div className="flex items-center gap-2 text-[10px] tracking-[0.35em] text-neutral-400 uppercase">
                <a href="/" className="hover:text-black transition-colors font-medium">Home</a>
                <ChevronRight size={10} strokeWidth={3} />
                {subCategorySlug ? (
                  <>
                    <a href={`/${mainCategoryKey}`} className="hover:text-black transition-colors font-medium">{mainCategoryEnglishMap[mainCategory] ?? mainCategory}</a>
                    <ChevronRight size={10} strokeWidth={3} />
                    <span className="text-neutral-600 font-semibold">{displayTitle}</span>
                  </>
                ) : (
                  <span className="text-neutral-600 font-semibold">{mainCategory}</span>
                )}
             </div>
          </div>
          
          <div className="flex items-end justify-between gap-4">
            <div>
                  <h1 className="text-[24px] md:text-[36px] font-light font-playfair tracking-[0.04em] text-neutral-900 mt-2">
                {displayTitleText}
              </h1>
              <p className="text-[12px] text-neutral-400 mt-1">
                {loading ? "Loading..." : `${sortedProducts.length} products`}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] tracking-[0.15em] text-neutral-400 uppercase hidden sm:block">Sort</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="text-[11px] tracking-[0.1em] border-b border-neutral-200 py-1 px-2 bg-transparent outline-none cursor-pointer text-neutral-700 font-medium"
                data-testid="product-listing-sort-select"
              >
                <option value="recommended">Recommended</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="newest">New Arrivals</option>
              </select>
            </div>
          </div>
          
          <div className="h-[1px] bg-neutral-100 mt-8" />
        </div>
      </div>

      {/* Grid */}
      <div className="px-6 md:px-10 lg:px-16">
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32 gap-6" data-testid="product-listing-loading">
              <Loader2 className="animate-spin text-neutral-200" size={48} />
              <p className="text-[9px] tracking-[0.4em] text-neutral-400 uppercase font-light">Collection coming soon</p>
            </div>
          ) : sortedProducts.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-5 gap-y-12 animate-in fade-in slide-in-from-bottom-2 duration-1000" data-testid="product-listing-grid">
              {sortedProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="text-center py-32 border border-dashed border-neutral-100 rounded-lg" data-testid="product-listing-empty">
              <p className="text-neutral-400 font-light italic">No products found in this category yet.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
