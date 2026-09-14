export interface CategoryDef {
  slug: string;
  name: string;
  dbCategory: string;
}

export const KADIN_CATEGORIES: Record<string, CategoryDef> = {
  elbise: { slug: "elbise", name: "Dress", dbCategory: "Women's Dress" },
  bluz: { slug: "bluz", name: "Blouse & Shirt", dbCategory: "Women's Blouse & Shirt" },
  ceket: { slug: "ceket", name: "Jacket", dbCategory: "Women's Jacket" },
  etek: { slug: "etek", name: "Skirt", dbCategory: "Women's Skirt" },
  pantolon: { slug: "pantolon", name: "Trousers", dbCategory: "Women's Trousers" },
  yeni: { slug: "yeni", name: "New Arrivals", dbCategory: "Women" }, // Handled by tags
  "cok-satan": { slug: "cok-satan", name: "Best Sellers", dbCategory: "Women" }, // Handled by tags
  koleksiyon: { slug: "koleksiyon", name: "Collection", dbCategory: "Women" }, // Handled by tags
};

export const ERKEK_CATEGORIES: Record<string, CategoryDef> = {
  takim: { slug: "takim", name: "Suit", dbCategory: "Men's Suit" },
  gomlek: { slug: "gomlek", name: "Shirt", dbCategory: "Men's Shirt" },
  pantolon: { slug: "pantolon", name: "Trousers", dbCategory: "Men's Trousers" },
  ceket: { slug: "ceket", name: "Jacket", dbCategory: "Men's Jacket" },
  yeni: { slug: "yeni", name: "New Arrivals", dbCategory: "Men" }, // Handled by tags
  "cok-satan": { slug: "cok-satan", name: "Best Sellers", dbCategory: "Men" }, // Handled by tags
  koleksiyon: { slug: "koleksiyon", name: "Collection", dbCategory: "Men" }, // Handled by tags
};

export function getCategoryBySlug(mainCategory: string, slug: string): CategoryDef | undefined {
  const normMain = mainCategory.toLowerCase().replace(/ı/g, 'i');
  if (normMain === "kadin") return KADIN_CATEGORIES[slug];
  if (normMain === "erkek") return ERKEK_CATEGORIES[slug];
  return undefined;
}

// Product `category` values are stored in English (e.g. "Men's Suit", "Women's Dress"),
// but storefront routes use Turkish slugs. This maps one to the other for product links.
const CATEGORY_PREFIX_TO_ROUTE_SLUG: { prefix: string; slug: string }[] = [
  { prefix: "Women", slug: "kadin" },
  { prefix: "Men", slug: "erkek" },
  { prefix: "Shoes", slug: "ayakkabi" },
  { prefix: "Bags", slug: "canta" },
  { prefix: "Accessories", slug: "aksesuar" },
  { prefix: "Perfume", slug: "parfum" },
  { prefix: "Makeup", slug: "makyaj" },
];

export function getStorefrontSlugForCategory(category: string): string {
  const match = CATEGORY_PREFIX_TO_ROUTE_SLUG.find((entry) => category.startsWith(entry.prefix));
  return match ? match.slug : category.toLowerCase().split(" ")[0];
}
