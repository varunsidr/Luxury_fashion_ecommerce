import type { Product } from "@/lib/productTypes";

type LocalProduct = Product & { slug?: string };

const seedProducts: LocalProduct[] = (() => {
  try {
    const { allProducts } = require("../../scripts/products-data.js");
    return Array.isArray(allProducts) ? allProducts : [];
  } catch {
    return [];
  }
})();

export const localProducts = seedProducts.map((product, index) => ({
  ...product,
  id: product.id ?? String(index + 1),
  brand: product.brand ?? null,
}));
