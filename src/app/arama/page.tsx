"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import ProductCard from "@/components/ProductCard";
import { Loader2 } from "lucide-react";
import { catalogRequest } from "@/lib/catalogRequest";

interface SearchProduct {
  id: string;
  name: string;
  category: string;
  price: number;
  image_url: string;
  tag?: string | null;
  brand?: string | null;
}

function AramaResults() {
  const searchParams = useSearchParams();
  const q = (searchParams.get("q") || "").trim();
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<{ key: string; products: SearchProduct[]; error: boolean } | null>(null);
  const key = JSON.stringify([q, retry]);
  const products = q && result?.key === key ? result.products : [];
  const loading = Boolean(q && result?.key !== key);
  const failed = Boolean(q && result?.key === key && result.error);

  useEffect(() => {
    if (!q) return;
    let active = true;
    const controller = new AbortController();
    const search = async () => {
      try {
        const [nameResult, categoryResult] = await catalogRequest((signal) => Promise.all([
          supabase.from("products").select("*").ilike("name", `%${q}%`).abortSignal(signal),
          supabase.from("products").select("*").ilike("category", `%${q}%`).abortSignal(signal),
        ]), controller.signal);
        if (nameResult.error || categoryResult.error) throw new Error("Search unavailable");
        const matches = [...(nameResult.data ?? []), ...(categoryResult.data ?? [])];
        const uniqueProducts = Array.from(new Map(matches.map((product) => [product.id, product])).values());
        if (active) setResult({ key, products: uniqueProducts, error: false });
      } catch {
        if (active) setResult({ key, products: [], error: true });
      }
    };

    void search();
    return () => {
      active = false;
      controller.abort();
    };
  }, [q, key]);

  return (
    <div className="pt-[120px] md:pt-[140px] pb-20 bg-white min-h-screen">
      <div className="px-6 md:px-10 lg:px-16">
        <div className="max-w-7xl mx-auto">
          <p className="text-[10px] tracking-[0.35em] text-neutral-400 mb-2 uppercase">
            <Link href="/" className="hover:text-black transition-colors">Home</Link>
            {" "}&rsaquo;{" "}Search
          </p>
          <h1 className="text-2xl md:text-3xl font-medium tracking-wide font-playfair mb-2">
            Search Results
          </h1>
          {q && (
            <p className="text-sm text-neutral-500 mb-10">
              &ldquo;{q}&rdquo; — {loading ? "searching..." : failed ? "search unavailable" : `${products.length} results found`}
            </p>
          )}

          {loading ? (
            <div className="flex justify-center items-center py-32">
              <Loader2 size={28} strokeWidth={1.5} className="animate-spin text-neutral-400" />
            </div>
          ) : failed ? (
            <div role="alert" className="text-center py-32">
              <p className="text-neutral-600 text-sm">We couldn&apos;t load search results. Please try again.</p>
              <button onClick={() => setRetry((value) => value + 1)} className="mt-4 border border-neutral-300 px-5 py-2 text-sm">Retry search</button>
            </div>
          ) : !q ? (
            <p className="py-32 text-center text-sm text-neutral-500">Enter a search term to find products.</p>
          ) : products.length === 0 ? (
            <div className="text-center py-32">
              <p className="text-neutral-400 text-sm tracking-wide">No results found.</p>
              <p className="text-neutral-300 text-xs mt-2">Try a different search term.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-10">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AramaPage() {
  return (
    <Suspense>
      <AramaResults />
    </Suspense>
  );
}
