import type { Product } from "../productTypes";

export const MAX_MESSAGES = 12;
export const MAX_MESSAGE_LENGTH = 1000;
export const MAX_CART_LINES = 30;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

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
  listProducts(): Promise<Product[]>;
}

export interface ToolContext {
  store: CatalogStore;
  authenticated: boolean;
  cart: CartLineInput[];
  lastUserMessage: string;
}

export interface ToolRunState {
  seenProducts: Map<string, ProductCardData>;
  lastProductIds: string[];
  actions: AddToCartAction[];
}
