import type { Product } from "../productTypes";
import type { AddToCartAction } from "./types";

// Match checkout membership rules. Never infer a missing size row from overall stock.
export const configuredSizes = (product: Product) => product.sizes ?? [];
export const configuredColors = (product: Product) => product.image_url.startsWith("/demo-products/") ? [] : product.color_options ?? [];

export function availableUnits(product: Product, size: string | null = null): number {
  const sizes = configuredSizes(product);
  const safe = (stock: number | null | undefined) => Number.isSafeInteger(stock) && stock! > 0 ? stock! : 0;
  if (!sizes.length) return size === null ? safe(product.stock) : 0;
  if (size !== null && !sizes.includes(size)) return 0;
  const units = (value: string) => {
    const rows = (product.size_stock ?? []).filter(row => row.size === value);
    return rows.length === 1 ? safe(rows[0].stock) : 0;
  };
  return size === null ? sizes.reduce((sum, value) => sum + units(value), 0) : units(size);
}

export function validVariant(product: Product, size: string | null, color: string | null) {
  const sizes = configuredSizes(product), colors = configuredColors(product);
  return (sizes.length ? size !== null && sizes.includes(size) : size === null) &&
    (colors.length ? color !== null && colors.some(option => option.name === color) : color === null);
}

export function cartAction(product: Product, size: string | null, color: string | null, quantity: number): AddToCartAction {
  return {
    type: "add_to_cart", productId: String(product.id), name: product.name, price: product.price,
    image_url: configuredColors(product).find(option => option.name === color)?.image_url || product.image_url,
    category: product.category, size, color, quantity,
  };
}
