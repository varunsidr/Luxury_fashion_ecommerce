export interface CategoryDef {
  slug: string;
  name: string;
  dbCategory: string;
}

export const MAIN_CATEGORY_LABELS: Record<string, string> = {
  "Kad\u0131n": "Women", Erkek: "Men", "Parf\u00fcm": "Perfume", "Ayakkab\u0131": "Shoes", "\u00c7anta": "Bags",
  Aksesuar: "Accessories", Makyaj: "Makeup", Women: "Women", Men: "Men", Perfume: "Perfume",
  Shoes: "Shoes", Bags: "Bags", Accessories: "Accessories", Makeup: "Makeup",
};

export const MAIN_CATEGORY_ROUTES: Record<string, string> = {
  Women: "women", Men: "men", Perfume: "perfume", Shoes: "shoes", Bags: "bags",
  Accessories: "accessories", Makeup: "makeup", "Kad\u0131n": "women", Erkek: "men", "Parf\u00fcm": "perfume",
  "Ayakkab\u0131": "shoes", "\u00c7anta": "bags", Aksesuar: "accessories", Makyaj: "makeup",
};

export const MAIN_CATEGORY_ALIASES: Record<string, string[]> = {
  Women: ["women", "womens", "kadin"], Men: ["men", "mens", "erkek"],
  Perfume: ["perfume", "parfum"], Shoes: ["shoes", "ayakkabi"],
  Bags: ["bags", "canta"], Accessories: ["accessories", "aksesuar"], Makeup: ["makeup", "makyaj"],
};
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
  if (normMain === "kadin" || normMain === "women") {
    const englishSlugs: Record<string, string> = {
      dress: "elbise", blouse: "bluz", jacket: "ceket", skirt: "etek", trousers: "pantolon",
      "new-arrivals": "yeni", "best-sellers": "cok-satan", collection: "koleksiyon",
    };
    return KADIN_CATEGORIES[englishSlugs[slug] ?? slug];
  }
  if (normMain === "erkek" || normMain === "men") {
    const englishSlugs: Record<string, string> = {
      suits: "takim", shirts: "gomlek", trousers: "pantolon", jacket: "ceket",
      "new-arrivals": "yeni", "best-sellers": "cok-satan", collection: "koleksiyon",
    };
    return ERKEK_CATEGORIES[englishSlugs[slug] ?? slug];
  }
  return undefined;
}

// Product `category` values are stored in English (e.g. "Men's Suit", "Women's Dress"),
// Product links and visible storefront URLs use English slugs.
const CATEGORY_PREFIX_TO_ROUTE_SLUG: { prefix: string; slug: string }[] = [
  { prefix: "Women", slug: "women" },
  { prefix: "Men", slug: "men" },
  { prefix: "Shoes", slug: "shoes" },
  { prefix: "Bags", slug: "bags" },
  { prefix: "Accessories", slug: "accessories" },
  { prefix: "Perfume", slug: "perfume" },
  { prefix: "Makeup", slug: "makeup" },
];

export function getStorefrontSlugForCategory(category: string): string {
  const match = CATEGORY_PREFIX_TO_ROUTE_SLUG.find((entry) => category.startsWith(entry.prefix));
  return match ? match.slug : category.toLowerCase().split(" ")[0];
}
