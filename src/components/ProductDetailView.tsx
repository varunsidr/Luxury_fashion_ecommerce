"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { Heart, Minus, Plus, ChevronDown, X, Star } from "lucide-react";
import { useFavorites } from "@/context/FavoritesContext";
import { useCart } from "@/context/CartContext";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import ProductCard from "@/components/ProductCard";

interface Review {
  id: string;
  product_id: string;
  name: string | null;
  rating: number;
  comment: string;
  created_at: string;
  admin_reply: string | null;
  replied_at: string | null;
  images?: string[];
}

interface SizeStock {
  size: string;
  stock: number;
}

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "TRY",
    minimumFractionDigits: 0,
  }).format(price);
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function ProductDetailView({ product, mainCategory }: { product: any, mainCategory: string }) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const { addItem } = useCart();
  const isFav = isFavorite(product.id.toString());
  const displayCategory = product.category
    ? product.category
        .replace(/Kadın/g, "Women")
        .replace(/Erkek/g, "Men")
        .replace(/Elbise/g, "Dress")
        .replace(/Bluz/g, "Blouse")
        .replace(/Gömlek/g, "Shirt")
        .replace(/Pantolon/g, "Trousers")
        .replace(/Etek/g, "Skirt")
        .replace(/Ceket/g, "Jacket")
        .replace(/Takım/g, "Suit")
        .replace(/Ayakkabı/g, "Shoes")
        .replace(/Çanta/g, "Bag")
        .replace(/Aksesuar/g, "Accessories")
        .replace(/Parfüm/g, "Perfume")
        .replace(/Makyaj/g, "Makeup")
        .replace(/Çok Satan/g, "Best Seller")
        .replace(/Öne Çıkan/g, "Featured")
        .replace(/Yeni/g, "New")
        .replace(/Klasik/g, "Classic")
        .replace(/Avangart/g, "Avant-garde")
    : "";
  const [schemaCopyStatus, setSchemaCopyStatus] = useState<string | null>(null);
  const displayProductName = product.name
    ? product.name
        .replace(/Kadın/g, "Women")
        .replace(/Erkek/g, "Men")
        .replace(/Elbise/g, "Dress")
        .replace(/Bluz/g, "Blouse")
        .replace(/Gömlek/g, "Shirt")
        .replace(/Pantolon/g, "Trousers")
        .replace(/Etek/g, "Skirt")
        .replace(/Ceket/g, "Jacket")
        .replace(/Takım/g, "Suit")
        .replace(/Ayakkabı/g, "Shoes")
        .replace(/Çanta/g, "Bag")
        .replace(/Aksesuar/g, "Accessories")
        .replace(/Parfüm/g, "Perfume")
        .replace(/Makyaj/g, "Makeup")
        .replace(/Süet/g, "Suede")
        .replace(/Keten/g, "Linen")
        .replace(/Deri/g, "Leather")
        .replace(/Pırlanta/g, "Diamond")
        .replace(/Saat/g, "Watch")
        .replace(/Gözlüğü/g, "Glasses")
        .replace(/Göz Kalemi/g, "Eyeliner")
        .replace(/Ruj/g, "Lipstick")
        .replace(/Kapatıcı/g, "Concealer")
        .replace(/Fondöten/g, "Foundation")
        .replace(/Allık/g, "Blush")
        .replace(/Dudak/g, "Lip")
        .replace(/Parlatıcı/g, "Gloss")
        .replace(/Koleksiyon/g, "Collection")
        .replace(/Yazlık/g, "Summer")
    : "";

  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);

  // Size-based stock
  const [sizeStocks, setSizeStocks] = useState<SizeStock[]>([]);

  // Related products ("Complete Your Look")
  const [relatedProducts, setRelatedProducts] = useState<any[]>([]);

  // Reviews state
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [reviewForm, setReviewForm] = useState({ name: "", rating: 0, comment: "" });
  const [reviewImages, setReviewImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [hoverRating, setHoverRating] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      // Size stocks
      const { data: stockData } = await supabase
        .from("product_size_stock")
        .select("size, stock")
        .eq("product_id", product.id);
      setSizeStocks(stockData ?? []);

      // Reviews
      setReviewsLoading(true);
      const { data } = await supabase
        .from("reviews")
        .select("*")
        .eq("product_id", product.id)
        .order("created_at", { ascending: false });
      setReviews(data ?? []);
      setReviewsLoading(false);

      // Related products from the same category, for "Complete Your Look"
      const { data: related } = await supabase
        .from("products")
        .select("*")
        .ilike("category", `${mainCategory}%`)
        .neq("id", product.id)
        .limit(8);
      setRelatedProducts(related ?? []);
    }
    fetchData();
  }, [product.id, mainCategory]);

  function getSizeStock(size: string) {
    return sizeStocks.find((s) => s.size === size)?.stock ?? null;
  }

  const selectedSizeStock = selectedSize ? getSizeStock(selectedSize) : null;
  const isOutOfStock = selectedSize !== null && selectedSizeStock === 0;

  async function submitReview() {
    if (!reviewForm.name.trim() || !reviewForm.rating || !reviewForm.comment.trim()) return;
    setSubmitting(true);
    setReviewError(null);

    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setSubmitting(false);
      setReviewError("Please sign in before submitting a review.");
      return;
    }

    // Build optimistic review object (pending)
    const tempId = `temp-${Date.now()}`;
    const tempReview: Review = {
      id: tempId,
      product_id: product.id,
      name: reviewForm.name.trim(),
      rating: reviewForm.rating,
      comment: reviewForm.comment.trim(),
      created_at: new Date().toISOString(),
      admin_reply: null,
      replied_at: null,
      images: reviewImages.length ? imagePreviews : undefined,
    };

    // Immediately show the user's review optimistically
    setReviews((prev) => [tempReview as any, ...prev]);
    setReviewForm({ name: "", rating: 0, comment: "" });
    setImagePreviews([]);
    setReviewImages([]);

    // If Supabase not configured (local dev), keep optimistic review and inform user
    if (!isSupabaseConfigured) {
      setSubmitting(false);
      setReviewSubmitted(true);
      setTimeout(() => setReviewSubmitted(false), 3000);
      return;
    }

    // If there are images, upload them first via server endpoint which will validate size
    let uploadedPaths: string[] | undefined = undefined;
    if (reviewImages.length > 0) {
      const form = new FormData();
      reviewImages.forEach((f) => form.append('images', f));
      form.append('productId', product.id);
      const resp = await fetch('/api/reviews/upload', { method: 'POST', body: form });
      const j = await resp.json();
      if (!resp.ok) {
        // remove optimistic review
        setReviews((prev) => prev.filter((r) => r.id !== tempId));
        setSubmitting(false);
        setReviewError(j?.error || 'Image upload failed');
        return;
      }
      uploadedPaths = j.paths;
    }

    const { data, error } = await supabase
      .from("reviews")
      .insert({
        product_id: product.id,
        user_id: authData.user.id,
        rating: tempReview.rating,
        comment: tempReview.comment,
        images: uploadedPaths ?? null,
      })
      .select()
      .single();

    if (!error && data) {
      // replace optimistic review with server response
      setReviews((prev) => [data, ...prev.filter((r) => r.id !== tempId)]);
      setReviewSubmitted(true);
      setTimeout(() => setReviewSubmitted(false), 3000);
    } else {
      // on error, remove optimistic and show inline error
      setReviews((prev) => prev.filter((r) => r.id !== tempId));
      const msg = error?.message || 'Failed to submit review';
      if (typeof msg === 'string' && msg.includes("Could not find the table 'public.reviews'")) {
        setReviewError('Database table `reviews` not found. Run the project `supabase_schema.sql` in your Supabase SQL editor (or create the `reviews` table) to enable reviews.');
      } else {
        setReviewError(msg);
      }
    }

    setSubmitting(false);
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    const arr: File[] = [];
    const previews: string[] = [];
    for (let i = 0; i < files.length && i < 3; i++) {
      const f = files[i];
      if (f.size > 2 * 1024 * 1024) {
        setReviewError('Each image must be <= 2MB');
        continue;
      }
      arr.push(f);
      previews.push(URL.createObjectURL(f));
    }
    setReviewImages(arr);
    setImagePreviews(previews);
  }

  function removePreview(index: number) {
    setReviewImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
  }

  async function copySchemaToClipboard() {
    setSchemaCopyStatus('loading');
    try {
      const resp = await fetch('/api/schema');
      if (!resp.ok) throw new Error('Could not load schema file');
      const text = await resp.text();
      await navigator.clipboard.writeText(text);
      setSchemaCopyStatus('copied');
      setTimeout(() => setSchemaCopyStatus(null), 3000);
    } catch (err: any) {
      setSchemaCopyStatus('error');
      setTimeout(() => setSchemaCopyStatus(null), 3000);
    }
  }

  const avgRating = reviews.length
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  const images: string[] = product.images?.length ? product.images : [product.image_url];
  const sizes: string[] = product.sizes ?? ["S", "M", "L", "XL"];
  const details: string[] = product.details ?? [
    "Made from sustainable materials.",
    "Dry clean only recommended.",
    "Model is 178 cm tall and wears size S."
  ];
  const measurements: string[] = product.measurements ?? [
    "Garment measurements may vary by size.",
    "Refer to the size guide for detailed body measurements.",
  ];
  const compositionCare: string[] = product.compositionCare ?? [
    "Exterior: 100% cotton.",
    "Lining: 100% polyester.",
    "Made in Turkey.",
  ];
  const shippingReturns: string[] = product.shippingReturns ?? [
    "Free standard shipping on all orders.",
    "Free returns within 30 days of delivery.",
    "Items must be unworn, unwashed and with original tags attached.",
  ];
  const accordionSections = [
    { key: "details", title: "Product Details", content: details },
    { key: "measurements", title: "Product Measurements", content: measurements },
    { key: "care", title: "Composition, Care & Origin", content: compositionCare },
    { key: "shipping", title: "Shipping, Exchanges & Returns", content: shippingReturns },
  ];

  return (
    <main className="pt-[120px] md:pt-[140px] pb-20 bg-white min-h-screen">
      {/* Breadcrumb */}
      <div className="px-6 md:px-10 lg:px-16 mb-8">
        <div className="max-w-7xl mx-auto">
          <p className="text-[10px] tracking-[0.35em] text-neutral-400 uppercase">
            <Link href="/" className="hover:text-black transition-colors">Home</Link>
            {" "}&rsaquo;{" "}
            <Link href={`/${mainCategory.toLowerCase().replace(/ı/g, 'i')}`} className="hover:text-black transition-colors">{mainCategory === 'Kadın' ? 'Women' : mainCategory === 'Erkek' ? 'Men' : mainCategory}</Link>
            {" "}&rsaquo;{" "}
            <span className="text-neutral-600">{product.name}</span>
          </p>
        </div>
      </div>

      {/* Product Layout */}
      <div className="px-6 md:px-10 lg:px-16">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
            {/* Left: Images */}
            <div className="flex flex-col md:flex-row gap-3 md:gap-4">
              {/* Desktop side thumbnails */}
              {images.length > 1 && (
                <div className="hidden md:flex flex-col gap-3 w-[70px] flex-shrink-0">
                  {images.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedImage(i)}
                      className={`relative aspect-[3/4] overflow-hidden border-2 transition-all duration-200 ${
                        selectedImage === i ? "border-black" : "border-transparent hover:border-neutral-300"
                      }`}
                    >
                      <Image src={img} alt="" fill className="object-cover object-top" />
                    </button>
                  ))}
                </div>
              )}
              {/* Main image */}
              <div className="relative flex-1 aspect-[3/4] overflow-hidden bg-neutral-50">
                <Image
                  src={images[selectedImage]}
                  alt={product.name}
                  fill
                  className="object-cover object-top"
                  priority
                />
              </div>
              {/* Mobile bottom thumbnails */}
              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1 md:hidden">
                  {images.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setSelectedImage(i)}
                      className={`relative w-16 aspect-[3/4] flex-shrink-0 overflow-hidden border-2 transition-all duration-200 ${
                        selectedImage === i ? "border-black" : "border-transparent hover:border-neutral-300"
                      }`}
                    >
                      <Image src={img} alt="" fill className="object-cover object-top" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Right: Info */}
            <div className="flex flex-col justify-center">
              <p className="text-[10px] tracking-[0.3em] text-neutral-400 uppercase mb-3">
                {displayCategory}
              </p>

              <h1 className="text-[24px] md:text-[30px] font-light font-playfair tracking-[0.03em] text-neutral-900 mb-4">
                {displayProductName}
              </h1>

              <p className="text-[18px] font-medium text-neutral-900 mb-8">
                {formatPrice(product.price)}
              </p>

              {product.description && (
                <p className="text-[13px] text-neutral-500 font-light leading-relaxed mb-8">
                  {product.description}
                </p>
              )}

              {/* Size selector */}
              {sizes.length > 0 && (
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] tracking-[0.25em] text-neutral-500 uppercase">Size</span>
                    <button
                      onClick={() => setSizeGuideOpen(true)}
                      className="text-[10px] tracking-[0.15em] text-neutral-400 underline underline-offset-2 hover:text-black transition-colors"
                    >
                      Size Guide
                    </button>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {sizes.map((size) => {
                      const stock = getSizeStock(size);
                      const outOfStock = stock !== null && stock === 0;
                      return (
                        <button
                          key={size}
                          onClick={() => !outOfStock && setSelectedSize(size)}
                          disabled={outOfStock}
                          data-testid={`product-detail-size-${size}`}
                          data-selected={selectedSize === size}
                          className={`relative w-12 h-12 text-[12px] tracking-wide font-medium border transition-all duration-200 ${
                            outOfStock
                              ? "border-neutral-100 text-neutral-300 cursor-not-allowed overflow-hidden"
                              : selectedSize === size
                              ? "border-black bg-black text-white"
                              : "border-neutral-200 text-neutral-700 hover:border-black"
                          }`}
                        >
                          {outOfStock && (
                            <span className="absolute inset-0 flex items-center justify-center">
                              <span className="absolute w-[130%] h-px bg-neutral-200 rotate-45" />
                            </span>
                          )}
                          {size}
                        </button>
                      );
                    })}
                  </div>
                  {isOutOfStock && (
                    <p className="text-[11px] text-red-400 mt-3 tracking-wide">This size is currently out of stock.</p>
                  )}
                </div>
              )}

              {/* Quantity */}
              <div className="mb-8">
                <span className="text-[10px] tracking-[0.25em] text-neutral-500 uppercase mb-3 block">Quantity</span>
                <div className="flex items-center border border-neutral-200 w-fit">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="w-10 h-10 flex items-center justify-center hover:bg-neutral-50 transition-colors"
                    data-testid="product-detail-quantity-decrease"
                  >
                    <Minus size={14} strokeWidth={1.5} />
                  </button>
                  <span className="w-12 text-center text-[13px] font-medium" data-testid="product-detail-quantity-value">{quantity}</span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="w-10 h-10 flex items-center justify-center hover:bg-neutral-50 transition-colors"
                    data-testid="product-detail-quantity-increase"
                  >
                    <Plus size={14} strokeWidth={1.5} />
                  </button>
                </div>
              </div>

              {/* Add to cart + Fav */}
              <div className="flex gap-3 mb-8">
                <button
                  onClick={() => !isOutOfStock && addItem({ id: product.id.toString(), name: product.name, price: product.price, image_url: images[0], category: product.category, size: selectedSize })}
                  disabled={isOutOfStock}
                  data-testid="product-detail-add-to-cart"
                  className={`flex-1 py-3.5 text-[11px] tracking-[0.25em] uppercase font-medium transition-colors duration-300 ${
                    isOutOfStock
                      ? "bg-neutral-100 text-neutral-400 cursor-not-allowed"
                      : "bg-black text-white hover:bg-neutral-800"
                  }`}
                >
                  {isOutOfStock ? "Out of stock" : "Add to cart"}
                </button>
                <button
                  onClick={() => toggleFavorite(product.id.toString())}
                  className="w-[52px] h-[52px] border border-neutral-200 flex items-center justify-center hover:border-black transition-colors duration-300 group"
                  data-testid="product-detail-favorite-button"
                >
                  <Heart
                    size={18}
                    strokeWidth={1.5}
                    className={`transition-colors duration-300 ${isFav ? "fill-red-500 text-red-500" : "text-neutral-400 group-hover:text-black"}`}
                  />
                </button>
              </div>

              {/* Details accordion sections */}
              <div className="border-t border-neutral-100">
                {accordionSections.map((section) => {
                  const isOpen = openSection === section.key;
                  return (
                    <div key={section.key} className="border-b border-neutral-100">
                      <button
                        onClick={() => setOpenSection(isOpen ? null : section.key)}
                        className="w-full flex items-center justify-between py-5"
                        data-testid={`product-detail-accordion-${section.key}`}
                      >
                        <span className="text-[11px] tracking-[0.2em] text-neutral-700 uppercase font-medium">
                          {section.title}
                        </span>
                        <ChevronDown
                          size={16}
                          strokeWidth={1.5}
                          className={`text-neutral-400 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
                        />
                      </button>
                      <div className={`overflow-hidden transition-all duration-400 ${isOpen ? "max-h-[400px] pb-5" : "max-h-0"}`}>
                        <ul className="flex flex-col gap-2">
                          {section.content.map((line, i) => (
                            <li key={i} className="text-[12px] text-neutral-500 font-light">
                              {line}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Complete Your Look */}
          {relatedProducts.length > 0 && (
            <div className="mt-20 md:mt-28">
              <h2 className="text-[11px] tracking-[0.3em] uppercase font-medium text-neutral-900 mb-6">
                Complete Your Look
              </h2>
              <div className="flex gap-5 overflow-x-auto pb-2 -mx-1 px-1" data-testid="product-detail-complete-your-look">
                {relatedProducts.map((related) => (
                  <div key={related.id} className="w-[45%] xs:w-[38%] sm:w-[28%] md:w-[22%] lg:w-[18%] flex-shrink-0">
                    <ProductCard product={related} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Reviews Section */}
      <div className="px-6 md:px-10 lg:px-16 mt-24 pb-24">
        <div className="max-w-7xl mx-auto">

          {/* Header */}
          <div className="flex items-center gap-6 mb-12 border-t border-neutral-900 pt-6">
              <h2 className="text-[11px] tracking-[0.3em] uppercase font-medium text-neutral-900 whitespace-nowrap">
              Reviews
            </h2>
            {reviews.length > 0 && (
              <>
                <div className="flex gap-0.5">
                  {[1,2,3,4,5].map((s) => (
                    <Star key={s} size={12} strokeWidth={1.2}
                      className={s <= Math.round(avgRating) ? "fill-neutral-800 text-neutral-800" : "text-neutral-300"}
                    />
                  ))}
                </div>
                <span className="text-[11px] text-neutral-400 font-light">
                  {avgRating.toFixed(1)} · {reviews.length} reviews
                </span>
              </>
            )}
          </div>

          {/* Form — full width on top */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16 pb-16 border-b border-neutral-100">
            <div>
                <label className="text-[10px] tracking-[0.2em] text-neutral-400 uppercase block mb-2">Full Name</label>
              <input
                type="text"
                value={reviewForm.name}
                onChange={(e) => setReviewForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Enter your name"
                className="w-full border-b border-neutral-200 py-2 text-[13px] font-light placeholder:text-neutral-300 focus:outline-none focus:border-neutral-800 transition-colors bg-transparent"
                data-testid="product-detail-review-name"
              />
            </div>

            <div>
              <label className="text-[10px] tracking-[0.2em] text-neutral-400 uppercase block mb-2">Rating</label>
              <div className="flex gap-1.5 py-1">
                {[1,2,3,4,5].map((s) => (
                  <button
                    key={s}
                    onMouseEnter={() => setHoverRating(s)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setReviewForm((f) => ({ ...f, rating: s }))}
                    data-testid={`product-detail-review-rating-${s}`}
                  >
                    <Star
                      size={20}
                      strokeWidth={1.2}
                      className={`transition-colors duration-100 ${
                        s <= (hoverRating || reviewForm.rating)
                          ? "fill-neutral-900 text-neutral-900"
                          : "text-neutral-200 hover:text-neutral-400"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-end">
              <button
                onClick={submitReview}
                disabled={submitting || !reviewForm.name.trim() || !reviewForm.rating || !reviewForm.comment.trim()}
                className="w-full py-3 bg-neutral-900 text-white text-[10px] tracking-[0.25em] uppercase font-medium hover:bg-black transition-colors duration-300 disabled:opacity-25 disabled:cursor-not-allowed"
                data-testid="product-detail-review-submit"
              >
                  {reviewSubmitted ? "Submitted" : submitting ? "Submitting..." : "Submit"}
              </button>
            </div>

            {reviewError && (
              <div className="mt-3 bg-red-50 text-red-600 p-3 border border-red-100 text-[13px]">
                <div className="mb-2">{reviewError}</div>
                {reviewError.includes('supabase_schema.sql') && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={copySchemaToClipboard}
                      className="py-2 px-3 bg-neutral-900 text-white text-[12px] rounded"
                    >
                      {schemaCopyStatus === 'loading' ? 'Copying...' : schemaCopyStatus === 'copied' ? 'Copied' : 'Copy schema (supabase_schema.sql)'}
                    </button>
                    <a href="https://app.supabase.com/" target="_blank" rel="noreferrer" className="text-[12px] underline">Open Supabase</a>
                  </div>
                )}
              </div>
            )}

            <div className="md:col-span-3">
              <label className="text-[10px] tracking-[0.2em] text-neutral-400 uppercase block mb-2">Your review</label>
              <textarea
                value={reviewForm.comment}
                onChange={(e) => setReviewForm((f) => ({ ...f, comment: e.target.value }))}
                placeholder="Share your thoughts about the product..."
                rows={3}
                className="w-full border-b border-neutral-200 py-2 text-[13px] font-light placeholder:text-neutral-300 focus:outline-none focus:border-neutral-800 transition-colors resize-none bg-transparent"
                data-testid="product-detail-review-comment"
              />
              {/* Image uploads */}
              <div className="mt-4">
                <label className="text-[10px] tracking-[0.2em] text-neutral-400 uppercase block mb-2">Add images (optional, up to 3, 2MB each)</label>
                <input type="file" accept="image/*" multiple onChange={handleImageSelect} />
                <div className="flex gap-2 mt-3">
                  {imagePreviews.map((p, i) => (
                    <div key={i} className="relative">
                      <img src={p} className="w-24 h-24 object-cover border" />
                      <button onClick={() => removePreview(i)} className="absolute top-0 right-0 bg-white p-1">X</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Review list */}
          {reviewsLoading && (
            <div className="flex flex-col gap-4">
              {[1,2,3].map((i) => (
                <div key={i} className="h-16 bg-neutral-50 animate-pulse" />
              ))}
            </div>
          )}

          {!reviewsLoading && reviews.length === 0 && (
            <p className="text-[13px] text-neutral-300 font-light">No reviews yet. Be the first to leave one.</p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-neutral-100">
            {reviews.map((review) => (
              <div key={review.id} className="bg-white p-6" data-testid="product-detail-review-item">
                <div className="flex gap-0.5 mb-3">
                  {[1,2,3,4,5].map((s) => (
                    <Star key={s} size={11} strokeWidth={1.2}
                      className={s <= review.rating ? "fill-neutral-800 text-neutral-800" : "text-neutral-200"}
                    />
                  ))}
                </div>
                <p className="text-[13px] text-neutral-600 font-light leading-relaxed mb-3">&ldquo;{review.comment}&rdquo;</p>
                {review.admin_reply && (
                  <div className="border-l-2 border-neutral-200 pl-3 mb-3">
                    <p className="text-[9px] tracking-[0.2em] text-neutral-400 uppercase mb-1">Store Reply</p>
                    <p className="text-[12px] text-neutral-500 font-light">{review.admin_reply}</p>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-medium text-neutral-800">{review.name ?? "Anonymous"}</span>
                  <span className="text-[10px] text-neutral-300">{formatDate(review.created_at)}</span>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* Size Guide Modal */}
      {sizeGuideOpen && (
        <>
          <div
            className="fixed inset-0 z-[80] bg-black/30 backdrop-blur-sm"
            onClick={() => setSizeGuideOpen(false)}
          />
          <div className="fixed inset-0 z-[90] flex items-center justify-center px-4">
            <div className="bg-white w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl">
              <div className="flex items-center justify-between px-6 py-5 border-b border-neutral-100">
                <h3 className="text-[13px] tracking-[0.25em] font-medium uppercase">Size Guide</h3>
                <button
                  onClick={() => setSizeGuideOpen(false)}
                  className="p-1 hover:rotate-90 transition-transform duration-300"
                >
                  <X size={18} strokeWidth={1.5} />
                </button>
              </div>
              <div className="px-6 py-6">
                <table className="w-full text-[12px] mb-8">
                  <thead>
                      <tr className="border-b border-neutral-200">
                      <th className="text-left py-3 text-[10px] tracking-[0.2em] text-neutral-400 uppercase font-medium">Size</th>
                      <th className="text-center py-3 text-[10px] tracking-[0.2em] text-neutral-400 uppercase font-medium">Chest</th>
                      <th className="text-center py-3 text-[10px] tracking-[0.2em] text-neutral-400 uppercase font-medium">Waist</th>
                    </tr>
                  </thead>
                  <tbody className="text-neutral-600 font-light">
                    {[
                      ["XS", "80-84 cm", "60-64 cm"],
                      ["S",  "84-88 cm", "64-68 cm"],
                      ["M",  "88-92 cm", "68-72 cm"],
                      ["L",  "92-96 cm", "72-76 cm"],
                    ].map(([s, g, b]) => (
                      <tr key={s} className="border-b border-neutral-50">
                        <td className="py-3 font-medium">{s}</td>
                        <td className="py-3 text-center">{g}</td>
                        <td className="py-3 text-center">{b}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
