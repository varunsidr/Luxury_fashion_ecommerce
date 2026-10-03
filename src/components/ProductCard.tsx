"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart } from "lucide-react";
import { useFavorites } from "@/context/FavoritesContext";
import { useCart } from "@/context/CartContext";
import { useCurrency } from "@/context/CurrencyContext";
import { getStorefrontSlugForCategory } from "@/lib/categories";
import { useState } from "react";

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    category: string;
    price: number;
    image_url: string;
    tag?: string | null;
    brand?: string | null;
    sizes?: string[] | null;
    stock?: number | null;
    size_stock?: { size: string; stock: number }[];
    color_options?: { name: string; hex: string; image_url?: string }[] | null;
  };
}

export const translateDisplayText = (value?: string | null) => {
  if (!value) return value ?? "";

  return value
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
    .replace(/Yeni/g, "New")
    .replace(/Çok Satan/g, "Best Seller")
    .replace(/Öne Çıkan/g, "Featured")
    .replace(/Klasik/g, "Classic")
    .replace(/Avangart/g, "Avant-garde")
    .replace(/Yazlık/g, "Summer")
    .replace(/Limitli/g, "Limited")
    .replace(/İkonik/g, "Iconic")
    .replace(/Nadir/g, "Rare")
    .replace(/Haute Couture/g, "Haute Couture")
    .replace(/Haute Joaillerie/g, "High Jewelry")
    .replace(/Güneş Gözlüğü/g, "Sunglasses")
    .replace(/Saat/g, "Watch")
    .replace(/Süet/g, "Suede")
    .replace(/Keten/g, "Linen")
    .replace(/Deri/g, "Leather")
    .replace(/Koleksiyon/g, "Collection")
    .replace(/Pırlanta/g, "Diamond")
    .replace(/Yüksek/g, "High")
    .replace(/Dudak/g, "Lip")
    .replace(/Parlatıcı/g, "Gloss")
    .replace(/Göz Kalemi/g, "Eyeliners")
    .replace(/Kapatıcı/g, "Concealer")
    .replace(/Fondöten/g, "Foundation")
    .replace(/Ruj/g, "Lipstick")
    .replace(/Allık/g, "Blush")
    .replace(/Kaş/g, "Brows")
    .replace(/Beyaz/g, "White")
    .replace(/Siyah/g, "Black")
    .replace(/Mavi/g, "Blue")
    .replace(/Yeşil/g, "Green")
    .replace(/Kahverengi/g, "Brown")
    .replace(/Kırmızı/g, "Red")
    .replace(/Pembe/g, "Pink")
    .replace(/Gri/g, "Gray")
    .replace(/Lacivert/g, "Navy")
    .replace(/Bej/g, "Beige")
    .replace(/Kum/g, "Sand")
    .replace(/Çizgili/g, "Striped")
    .replace(/Zümrüt/g, "Emerald")
    .replace(/Şık/g, "Stylish")
    .replace(/Koyu Kahve/g, "Dark Brown")
    .replace(/Koyu Bej/g, "Dark Beige")
    .replace(/Kesimli/g, "Tailored")
    .replace(/Koyu/g, "Dark")
    .replace(/Kahve/g, "Brown")
    .replace(/Bluz/g, "Blouse")
    .replace(/Ekru|Krem/g, "Cream")
    .replace(/Drapeli/g, "Draped")
    .replace(/Motorcu/g, "Biker")
    .replace(/Kapitone/g, "Quilted")
    .replace(/Zincirli/g, "Chain")
    .replace(/Fiyonklu/g, "Bow")
    .replace(/Monokrom/g, "Monochrome")
    .replace(/Jakar/g, "Jacquard")
    .replace(/Yün/g, "Wool")
    .replace(/Pamuklu/g, "Cotton")
    .replace(/Likit/g, "Liquid")
    .replace(/Işıltılı/g, "Shimmering")
    .replace(/Far/g, "Eyeshadow")
    .replace(/Bilekten Bağlamalı/g, "Ankle-Strap")
    .replace(/Bileklik/g, "Bracelet")
    .replace(/Kargo/g, "Cargo")
    .replace(/Kesim/g, "Cut")
    .replace(/Kömür/g, "Charcoal")
    .replace(/İnci/g, "Pearl")
    .replace(/Bordo/g, "Burgundy")
    .replace(/Beltli/g, "Belted")
    .replace(/Organik/g, "Organic")
    .replace(/Pamuk/g, "Cotton")
    .replace(/Bebe/g, "Baby")
    .replace(/Topuklu/g, "Heeled")
    .replace(/Bebek Mavi/g, "Baby Blue")
    .replace(/Jakar/g, "Jacquard")
    .replace(/Kruvaze/g, "Double-Breasted")
    .replace(/Keten/g, "Linen")
    .replace(/Saten/g, "Satin")
    .replace(/Deri/g, "Leather")
    .replace(/Süet/g, "Suede")
    .replace(/Altın/g, "Gold")
    .replace(/Gözlüğü/g, "Glasses")
    .replace(/Güneş/g, "Sun")
    .replace(/Bagssı/g, "Bag")
    .replace(/Baby Blue Heeled/g, "Baby Blue Pumps");
};

export default function ProductCard({ product }: ProductCardProps) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const { addItem } = useCart();
  const { formatPrice } = useCurrency();
  const isDemoProduct = product.image_url.startsWith("/demo-products/");
  const colorOptions = isDemoProduct ? [] : product.color_options ?? [];
  const [selectedColor, setSelectedColor] = useState(colorOptions[0] ?? null);
  const isFav = isFavorite(product.id);
  const displayCategory = translateDisplayText(product.category);
  const displayName = translateDisplayText(product.name);
  const displayTag = translateDisplayText(product.tag ?? "");
  const hasStock = product.sizes?.length
    ? product.size_stock?.length
      ? product.size_stock.some((entry) => Number(entry.stock) > 0)
      : Number(product.stock ?? 0) > 0
    : Number(product.stock ?? 0) > 0;

  return (
    <div className="group relative transition-transform duration-500 hover:-translate-y-1 motion-safe:animate-[catalog-enter_450ms_ease-out_both]" data-testid="product-card" data-product-id={product.id}>
      {/* Favorite Button */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          toggleFavorite(product.id);
        }}
        className="absolute top-3 right-3 z-20 p-2 bg-white/80 backdrop-blur-sm rounded-full shadow-sm transition-all duration-300 hover:scale-110 active:scale-95 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
        aria-label={isFav ? "Remove from favorites" : "Add to favorites"}
        data-testid="product-card-favorite-button"
      >
        <Heart
          size={18}
          strokeWidth={1.5}
          className={`transition-colors duration-300 ${
            isFav ? "fill-red-500 text-red-500" : "text-neutral-400 group-hover:text-black"
          }`}
        />
      </button>

      <div className="relative aspect-[3/4] overflow-hidden bg-neutral-50 mb-4">
        <Link href={`/${getStorefrontSlugForCategory(product.category)}/${product.id}`} className="block h-full" data-testid="product-card-link">
          {product.tag && (
            <span className="absolute top-3 left-3 z-10 text-[9px] tracking-[0.15em] uppercase bg-black text-white px-2 py-1">
              {displayTag}
            </span>
          )}
          <Image
            src={selectedColor?.image_url ?? product.image_url}
            alt={displayName}
            fill
            className={`object-cover object-top origin-top transition-transform duration-700 ${isDemoProduct ? "scale-[1.08] group-hover:scale-[1.12]" : "group-hover:scale-105"} ${hasStock ? "" : "grayscale-[35%]"}`}
          />
          {!hasStock && <span className="absolute inset-x-0 top-1/2 z-10 mx-auto w-fit -translate-y-1/2 border border-white/50 bg-black/75 px-5 py-3 text-[9px] font-medium uppercase tracking-[0.28em] text-white backdrop-blur-sm">Out of stock</span>}
        </Link>

        {hasStock && <button
          onClick={() => {
            if (product.sizes?.length) return;
            addItem({ id: product.id, name: displayName, price: product.price, image_url: selectedColor?.image_url ?? product.image_url, category: product.category, size: null, color: selectedColor?.name ?? null });
          }}
          className={`absolute inset-x-0 bottom-0 bg-black/80 py-3 text-center transition-transform duration-400 ${product.sizes?.length ? "hidden" : "translate-y-0 sm:translate-y-full sm:group-hover:translate-y-0"}`}
          data-testid="product-card-add-to-cart"
          aria-label={`Add ${displayName} to cart`}
        >
          <span className="text-[10px] tracking-[0.2em] text-white uppercase">
            Add to cart
          </span>
        </button>}
        {hasStock && product.sizes?.length ? (
          <Link href={`/${getStorefrontSlugForCategory(product.category)}/${product.id}`} className="absolute inset-x-0 bottom-0 bg-black/80 py-3 text-center text-[10px] uppercase tracking-[0.2em] text-white sm:translate-y-full sm:transition-transform sm:group-hover:translate-y-0" aria-label={`Choose a size for ${displayName}`}>
            Choose size
          </Link>
        ) : null}
      </div>

      {colorOptions.length > 0 && (
        <div className="mb-2 flex items-center gap-2" aria-label={`${colorOptions.length} colors available`}>
          <div className="flex items-center gap-1.5">
            {colorOptions.map((color) => (
              <button
                key={color.name}
                type="button"
                title={color.name}
                aria-label={`Show ${color.name} ${displayName}`}
                aria-pressed={selectedColor?.name === color.name}
                onClick={() => setSelectedColor(color)}
                className={`h-3.5 w-3.5 rounded-full border border-black/15 transition-transform hover:scale-125 ${selectedColor?.name === color.name ? "ring-1 ring-black ring-offset-1" : ""}`}
                style={{ backgroundColor: color.hex }}
              />
            ))}
          </div>
          <span className="text-[9px] uppercase tracking-[0.12em] text-neutral-400">{colorOptions.length} colors</span>
        </div>
      )}

      <Link href={`/${getStorefrontSlugForCategory(product.category)}/${product.id}`} className="block">
        <div className="flex flex-col gap-1">
          {product.brand && (
            <p className="text-[9px] tracking-[0.2em] text-neutral-400 uppercase">
              {product.brand}
            </p>
          )}
          <p className="text-[10px] tracking-[0.15em] text-neutral-400 uppercase text-[9px]">
            {displayCategory}
          </p>
          <h3 className="text-[13px] tracking-wide text-neutral-900 font-light group-hover:underline underline-offset-2 font-playfair mt-0.5" data-testid="product-card-name">
            {displayName}
          </h3>
          <p className="text-[13px] font-medium text-neutral-900 mt-1" data-testid="product-card-price">
            {formatPrice(product.price)}
          </p>
          {!hasStock && <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-500">Currently unavailable</p>}
        </div>
      </Link>

    </div>
  );
}
