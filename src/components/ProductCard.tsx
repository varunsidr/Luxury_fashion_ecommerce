"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart } from "lucide-react";
import { useFavorites } from "@/context/FavoritesContext";
import { useCart } from "@/context/CartContext";
import { getStorefrontSlugForCategory } from "@/lib/categories";

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    category: string;
    price: number;
    image_url: string;
    tag?: string | null;
    brand?: string | null;
  };
}

const translateDisplayText = (value?: string | null) => {
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
    .replace(/Şık/g, "Stylish");
};

export default function ProductCard({ product }: ProductCardProps) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const { addItem } = useCart();
  const isFav = isFavorite(product.id);
  const displayCategory = translateDisplayText(product.category);
  const displayName = translateDisplayText(product.name);
  const displayTag = translateDisplayText(product.tag ?? "");

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "TRY",
      minimumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className="group relative" data-testid="product-card" data-product-id={product.id}>
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
            src={product.image_url}
            alt={product.name}
            fill
            className="object-cover object-top transition-transform duration-700 group-hover:scale-105"
          />
        </Link>

        <button
          onClick={() => {
            addItem({ id: product.id, name: product.name, price: product.price, image_url: product.image_url, category: product.category, size: null });
          }}
          className="absolute inset-x-0 bottom-0 bg-black/80 py-3 text-center translate-y-full group-hover:translate-y-0 transition-transform duration-400"
          data-testid="product-card-add-to-cart"
          aria-label={`Add ${displayName} to cart`}
        >
          <span className="text-[10px] tracking-[0.2em] text-white uppercase">
            Add to cart
          </span>
        </button>
      </div>

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
        </div>
      </Link>

    </div>
  );
}
