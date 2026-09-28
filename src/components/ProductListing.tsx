"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { localProducts } from "@/lib/localProducts";
import ProductCard from "@/components/ProductCard";
import { Loader2, ChevronRight, SlidersHorizontal, X } from "lucide-react";
import { useCurrency } from "@/context/CurrencyContext";
import { getCategoryBySlug, MAIN_CATEGORY_ALIASES, MAIN_CATEGORY_LABELS, MAIN_CATEGORY_ROUTES } from "@/lib/categories";
import { normalizeCatalogText, Product } from "@/lib/productTypes";

interface ProductListingProps {
  mainCategory: string; // e.g., "Kadın", "Erkek", "Parfüm"
  subCategory?: string; // e.g., "Elbise", "Gömlek"
  subCategorySlug?: string;
}

function getPriceSuggestions(prices: number[], currency: "INR" | "USD") {
  const sorted = prices.filter((price) => Number.isFinite(price) && price > 0).sort((a, b) => a - b);
  if (!sorted.length) return [1000, 2500, 5000];

  const highest = sorted[sorted.length - 1];
  const step = currency === "INR"
    ? highest <= 25_000 ? 2500 : highest <= 75_000 ? 5000 : 10_000
    : highest <= 100 ? 25 : highest <= 250 ? 50 : highest <= 1000 ? 100 : highest <= 2500 ? 250 : highest <= 5000 ? 500 : 1000;
  const percentile = (position: number) => sorted[Math.round((sorted.length - 1) * position)];
  const roundTier = (price: number) => Math.max(step, Math.round(price / step) * step);
  const candidates = [roundTier(sorted[0]), roundTier(percentile(0.5)), roundTier(percentile(0.85))];
  return candidates.reduce<number[]>((tiers, tier) => {
    const previous = tiers[tiers.length - 1] ?? 0;
    tiers.push(tier > previous ? tier : previous + step);
    return tiers;
  }, []);
}

export default function ProductListing({ mainCategory, subCategory, subCategorySlug }: ProductListingProps) {
  const { currency, convertPrice } = useCurrency();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState("recommended");
  const [brand, setBrand] = useState("");
  const [size, setSize] = useState("");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [visibleCount, setVisibleCount] = useState(24);

  // Handle Turkish İ/ı vs I/i mapping for keys
  const mainCategoryKey = mainCategory.toLowerCase().replace(/ı/g, 'i');
  
  // Categorization Logic
  const isMainCategoryOnly = !subCategorySlug;
  const categoryDef = subCategorySlug ? getCategoryBySlug(mainCategoryKey, subCategorySlug) : undefined;
  
  const dbCategory = categoryDef ? categoryDef.dbCategory : mainCategory;
  const displayTitle = subCategory || mainCategory;
  const dataCategoryPrefix = MAIN_CATEGORY_LABELS[mainCategory] ?? mainCategory;
  const displayTitleText = categoryDef?.name ?? (MAIN_CATEGORY_LABELS[mainCategory] ?? displayTitle);
  const mainCategoryRoute = MAIN_CATEGORY_ROUTES[mainCategory] ?? mainCategoryKey;

  const normalizeValue = normalizeCatalogText;

  const matchesMainCategory = (product: Product) => {
    const productCategory = normalizeValue(product.category);
    const target = normalizeValue(dataCategoryPrefix);

    if (!productCategory) return false;

    // Some imported rows may contain Turkish labels instead of English labels.
    const aliases = MAIN_CATEGORY_ALIASES[dataCategoryPrefix] ?? [target];
    return aliases.some((alias) => {
      const categoryTokens = productCategory.split(/[\s/&-]+/).filter(Boolean);
      return categoryTokens.includes(normalizeValue(alias));
    });
  };

  const matchesProductFilter = (product: Product) => {
    if (isMainCategoryOnly) return matchesMainCategory(product);

    if (subCategorySlug === "yeni") {
      return matchesMainCategory(product) && normalizeValue(product.tag).includes("new");
    }

    if (subCategorySlug === "cok-satan") {
      const tag = normalizeValue(product.tag);
      return matchesMainCategory(product) && (tag.includes("best") || tag.includes("featured") || tag.includes("populer"));
    }

    if (subCategorySlug === "koleksiyon") {
      return matchesMainCategory(product);
    }

    const productCategory = normalizeValue(product.category);
    const targetCategory = normalizeValue(dbCategory);
    const subCategoryName = normalizeValue(categoryDef?.name ?? subCategory ?? "");

    return Boolean(subCategoryName) && (productCategory === targetCategory ||
      productCategory.includes(targetCategory) ||
      productCategory.includes(subCategoryName));
  };

  const filterProducts = (items: Product[]) => items.filter((product) => matchesProductFilter(product));

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const useLocal = !isSupabaseConfigured || !supabase;
      if (useLocal) {
        const filtered = filterProducts(localProducts);
        setProducts(filtered);
        setLoading(false);
        return;
      }

      let query = supabase.from("products").select("*");

      if (isMainCategoryOnly) {
        query = query.ilike("category", `%${dataCategoryPrefix}%`);
      } else if (subCategorySlug === "yeni") {
        query = query.ilike("category", `%${dataCategoryPrefix}%`).ilike("tag", "%New%");
      } else if (subCategorySlug === "cok-satan") {
        query = query.ilike("category", `%${dataCategoryPrefix}%`).or("tag.ilike.%Best%,tag.ilike.%Featured%,tag.ilike.%Populer%");
      } else if (subCategorySlug === "koleksiyon") {
        query = query.ilike("category", `%${dataCategoryPrefix}%`);
      } else {
        query = query.ilike("category", `%${dbCategory}%`);
      }

      const [{ data, error }, { data: stockRows }] = await Promise.all([
        query,
        supabase.from("product_size_stock").select("product_id,size,stock"),
      ]);

      if (error) {
        console.warn("Supabase fetch failed, using local catalog fallback.", error);
        const filtered = filterProducts(localProducts);
        setProducts(filtered);
      } else {
        const stockByProduct = new Map<string, Array<{ size: string; stock: number }>>();
        for (const row of stockRows ?? []) stockByProduct.set(row.product_id, [...(stockByProduct.get(row.product_id) ?? []), { size: row.size, stock: Number(row.stock) }]);
        setProducts(filterProducts(((data ?? []) as Product[]).map((p) => ({ ...p, size_stock: stockByProduct.get(String(p.id)) ?? [] }))));
      }
    } catch (err) {
      console.error("Fetch error, falling back to local catalog:", err);
      const filtered = filterProducts(localProducts);
      setProducts(filtered);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [mainCategory, subCategorySlug, dbCategory, isMainCategoryOnly]);

  useEffect(() => {
    setMinPrice("");
    setMaxPrice("");
  }, [currency]);

  const brandOptions = useMemo(() => [...new Set(products.map((p) => p.brand).filter((v): v is string => Boolean(v)))].sort(), [products]);
  const sizeOptions = useMemo(() => [...new Set(products.flatMap((p) => p.sizes ?? []))].sort(), [products]);
  const priceSuggestions = useMemo(
    () => getPriceSuggestions(products.map((product) => convertPrice(product.price)), currency),
    [products, convertPrice, currency],
  );
  const sliderMax = useMemo(() => {
    const highest = Math.max(0, ...products.map((product) => convertPrice(product.price)));
    const naturalMax = Math.max(1000, Math.ceil(highest / 1000) * 1000);
    return Math.max(naturalMax, priceSuggestions[priceSuggestions.length - 1]);
  }, [products, convertPrice, priceSuggestions]);
  const selectedMin = minPrice === "" ? 0 : Number(minPrice);
  const selectedMax = maxPrice === "" ? sliderMax : Number(maxPrice);
  const formatDisplayPrice = (amount: number) => new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency", currency, minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(Math.round(amount));
  const priceSteps = priceSuggestions.map((amount) => ({ value: amount, label: formatDisplayPrice(amount) }));
  const hasAvailableStock = useCallback((product: Product) => {
    if (!product.sizes?.length) return (product.stock ?? 0) > 0;
    if (!product.size_stock?.length) return (product.stock ?? 0) > 0;
    return product.size_stock.some((entry) => entry.stock > 0 && (!size || entry.size === size));
  }, [size]);
  const filteredProducts = useMemo(() => products.filter((p) => {
    const displayPrice = convertPrice(p.price);
    return (!brand || p.brand === brand) && (!size || p.sizes?.includes(size)) &&
      (!inStockOnly || hasAvailableStock(p)) &&
      displayPrice >= (minPrice === "" ? 0 : Number(minPrice)) && displayPrice <= (maxPrice === "" ? Infinity : Number(maxPrice));
  }), [products, brand, size, inStockOnly, minPrice, maxPrice, hasAvailableStock, convertPrice]);
  const getSortedProducts = () => {
    let sorted = [...filteredProducts];
    if (sortBy === "price-low") {
      sorted.sort((a, b) => a.price - b.price || a.name.localeCompare(b.name));
    } else if (sortBy === "price-high") {
      sorted.sort((a, b) => b.price - a.price || a.name.localeCompare(b.name));
    } else if (sortBy === "newest") {
      sorted.sort((a, b) => Number(normalizeValue(b.tag).includes("new")) - Number(normalizeValue(a.tag).includes("new")) || String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")) || a.name.localeCompare(b.name));
    }
    return sorted;
  };

  const sortedProducts = getSortedProducts();
  const visibleProducts = sortedProducts.slice(0, visibleCount);

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
                    <a href={`/${mainCategoryRoute}`} className="hover:text-black transition-colors font-medium">{MAIN_CATEGORY_LABELS[mainCategory] ?? mainCategory}</a>
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
                {loading ? "Loading..." : `${sortedProducts.length} of ${products.length} products`}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="product-sort" className="text-[11px] tracking-[0.15em] text-neutral-400 uppercase hidden sm:block">Sort</label>
              <select
                id="product-sort"
                aria-label="Sort products"
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

          <div className="mt-7 border-y border-neutral-200 py-4" aria-label="Product filters">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-700"><SlidersHorizontal size={14} strokeWidth={1.5} /> Refine your selection</div>
              {(brand || size || minPrice || maxPrice || inStockOnly) && <button type="button" onClick={() => { setBrand(""); setSize(""); setMinPrice(""); setMaxPrice(""); setInStockOnly(false); }} className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] text-neutral-500 transition hover:text-neutral-900"><X size={12} /> Clear all</button>}
            </div>
            <div className="flex flex-wrap items-end gap-x-7 gap-y-4">
              {brandOptions.length > 0 && <label className="flex min-w-[155px] flex-col gap-1.5 text-[9px] font-medium uppercase tracking-[0.18em] text-neutral-400">Brand<select aria-label="Filter by brand" value={brand} onChange={(e) => setBrand(e.target.value)} className="h-9 min-w-0 border-b border-neutral-300 bg-transparent pr-6 text-[12px] normal-case tracking-normal text-neutral-800 outline-none transition focus:border-neutral-900"><option value="">All brands</option>{brandOptions.map((b) => <option key={b}>{b}</option>)}</select></label>}
              {sizeOptions.length > 0 && <label className="flex min-w-[110px] flex-col gap-1.5 text-[9px] font-medium uppercase tracking-[0.18em] text-neutral-400">Size<select aria-label="Filter by size" value={size} onChange={(e) => setSize(e.target.value)} className="h-9 min-w-0 border-b border-neutral-300 bg-transparent pr-6 text-[12px] normal-case tracking-normal text-neutral-800 outline-none transition focus:border-neutral-900"><option value="">All sizes</option>{sizeOptions.map((s) => <option key={s}>{s}</option>)}</select></label>}
              <fieldset className="basis-full min-w-0 flex-1 pt-1 md:basis-auto md:min-w-[320px] md:max-w-[480px]">
                <legend className="text-[9px] font-medium uppercase tracking-[0.18em] text-neutral-400">Price range · {currency}</legend>
                <div className="mt-1 flex flex-wrap items-end justify-between gap-2">
                  <span className="text-[11px] tabular-nums text-neutral-700">{formatDisplayPrice(selectedMin)} – {formatDisplayPrice(selectedMax)}</span>
                </div>
                <div className="relative mt-3 h-7">
                  <div className="absolute left-0 right-0 top-[12px] h-px bg-neutral-200" />
                  <div className={`absolute top-[11px] h-[3px] ${minPrice || maxPrice ? "bg-neutral-800" : "bg-transparent"}`} style={{ left: `${(selectedMin / sliderMax) * 100}%`, width: `${Math.max(0, ((selectedMax - selectedMin) / sliderMax) * 100)}%` }} />
                  <input type="range" aria-label="Minimum price" aria-valuetext={formatDisplayPrice(selectedMin)} min="0" max={sliderMax} step={currency === "INR" ? sliderMax > 50_000 ? 500 : 100 : sliderMax > 1000 ? 10 : 1} value={selectedMin} onChange={(event) => setMinPrice(String(Math.min(Number(event.target.value), selectedMax)))} className="catalog-range absolute inset-x-0 top-0 z-10 h-7 w-full" />
                  <input type="range" aria-label="Maximum price" aria-valuetext={formatDisplayPrice(selectedMax)} min="0" max={sliderMax} step={currency === "INR" ? sliderMax > 50_000 ? 500 : 100 : sliderMax > 1000 ? 10 : 1} value={selectedMax} onChange={(event) => setMaxPrice(String(Math.max(Number(event.target.value), selectedMin)))} className="catalog-range absolute inset-x-0 top-0 z-20 h-7 w-full" />
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {priceSteps.map((step) => <button key={step.value} type="button" aria-pressed={selectedMin === 0 && selectedMax === step.value} onClick={() => { setMinPrice("0"); setMaxPrice(String(step.value)); }} className={`border px-3 py-1.5 text-[10px] transition-colors ${selectedMin === 0 && selectedMax === step.value ? "border-neutral-900 bg-neutral-900 text-white" : "border-neutral-200 text-neutral-600 hover:border-neutral-500"}`}>Under {step.label}</button>)}
                </div>
              </fieldset>
              <label className="flex h-9 cursor-pointer items-center gap-2.5 text-[11px] text-neutral-700 md:ml-auto"><input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} className="h-4 w-4 accent-neutral-900" /> In stock only</label>
            </div>
          </div>
          
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
                {visibleProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
            </div>
          ) : (
            <div className="text-center py-32 border border-dashed border-neutral-100 rounded-lg" data-testid="product-listing-empty">
              <p className="text-neutral-700 font-playfair text-xl">{products.length === 0 ? "The collection is on its way." : "No pieces match these filters."}</p>
              <p className="mt-2 text-sm text-neutral-400">{products.length === 0 ? "Please check back soon." : "Try adjusting your selection to see more of the collection."}</p>
              {products.length > 0 && <button type="button" onClick={() => { setBrand(""); setSize(""); setMinPrice(""); setMaxPrice(""); setInStockOnly(false); }} className="mt-5 border-b border-neutral-500 pb-1 text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-700 transition hover:border-neutral-900 hover:text-neutral-900">Clear filters</button>}
            </div>
          )}
          {!loading && visibleCount < sortedProducts.length && (
            <div className="mt-12 text-center"><button type="button" onClick={() => setVisibleCount((count) => count + 24)} className="border border-neutral-300 px-8 py-3 text-xs uppercase tracking-widest hover:border-black">Load more products</button></div>
          )}
        </div>
      </div>
    </main>
  );
}
