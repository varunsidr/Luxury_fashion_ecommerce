const seedProducts = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { allProducts } = require("../../scripts/products-data.js");
    return Array.isArray(allProducts) ? allProducts : [];
  } catch {
    return [];
  }
})();

export const localProducts = seedProducts.map((product: any, index: number) => ({
  ...product,
  id: product.id ?? String(index + 1),
  brand: product.brand ?? null,
}));
