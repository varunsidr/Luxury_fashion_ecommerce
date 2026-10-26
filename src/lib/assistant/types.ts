import type { Product } from "../productTypes";

export const MAX_MESSAGES = 12;
export const MAX_MESSAGE_LENGTH = 1000;
export const MAX_CART_LINES = 30;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  /** Ordered references only; the server reloads all facts from its catalog. */
  productIds?: string[];
}

export interface AssistantDisplay { currency: "INR" | "USD"; rate: number }

export type AssistantInteraction =
  | { type: "similar"; productId: string }
  | { type: "compare"; productIds: string[] }
  | { type: "prepare_add"; productId: string; size: string | null; color: string | null; quantity: number };

export interface CartLineInput {
  id: string;
  size: string | null;
  color: string | null;
  quantity: number;
}

/** Product card sent to the browser. Built only from catalog data, never from model text. */
export interface ProductCardData {
  id: string;
  name: string;
  category: string;
  price: number;
  image_url: string;
  url: string;
  inStock: boolean;
  brand?: string | null;
  sizes?: Array<{ size: string; inStock: boolean }>;
  colors?: string[];
}

/** A cart change proposed by the assistant. It only takes effect after the shopper clicks Confirm. */
export interface AddToCartAction {
  type: "add_to_cart";
  productId: string;
  name: string;
  price: number;
  image_url: string;
  category: string;
  size: string | null;
  color: string | null;
  quantity: number;
}

export interface AssistantReply {
  reply: string;
  products: ProductCardData[];
  actions: AddToCartAction[];
}

/** Read-only catalog access; the production implementation reuses the storefront's Supabase client. */
export interface CatalogStore {
  listProducts(options?: { fresh?: boolean; signal?: AbortSignal }): Promise<Product[]>;
}

export interface ToolContext {
  store: CatalogStore;
  authenticated: boolean;
  cart: CartLineInput[];
  lastUserMessage: string;
  display?: AssistantDisplay;
  signal?: AbortSignal;
}

export interface ToolRunState {
  seenProducts: Map<string, ProductCardData>;
  lastProductIds: string[];
  actions: AddToCartAction[];
  /** Text composed exclusively by tools from catalog fields or checked-in copy. */
  sections: Map<string, string>;
}
