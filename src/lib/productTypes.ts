export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  image_url: string;
  images?: string[] | null;
  sizes?: string[] | null;
  description?: string | null;
  stock?: number | null;
  size_stock?: ProductSizeStock[];
  tag?: string | null;
  brand?: string | null;
  created_at?: string | null;
  compositionCare?: string | null;
  details?: string | null;
  measurements?: string | null;
  shippingReturns?: string | null;
  color_options?: ProductColorOption[] | null;
}

export interface ProductColorOption {
  name: string;
  hex: string;
  image_url?: string;
}

export interface ProductSizeStock {
  product_id?: string;
  size: string;
  stock: number;
}

export const normalizeCatalogText = (value: unknown) => String(value ?? "")
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/\u0131/g, "i")
  .toLocaleLowerCase("en")
  .replace(/[\u2019']/g, "")
  .replace(/\s+/g, " ")
  .trim();
