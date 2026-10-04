export interface CartItem {
  id: string;
  name: string;
  price: number;
  image_url: string;
  category: string;
  size: string | null;
  color?: string | null;
  quantity: number;
}

export const CART_STORAGE_KEY = "els-cart";

// Stored browser data is untrusted. Recover valid lines without letting a bad
// line crash rendering, produce NaN totals, or remove the remaining cart.
export function restoreCart(raw: string | null): { items: CartItem[]; recovered: boolean } {
  if (raw === null) return { items: [], recovered: false };
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return { items: [], recovered: true }; }
  if (!Array.isArray(value)) return { items: [], recovered: true };

  const items: CartItem[] = [];
  let recovered = false;
  for (const entry of value) {
    if (!entry || typeof entry !== "object" ||
      ![entry.id, entry.name, entry.image_url, entry.category].every((field) => typeof field === "string" && field.trim()) ||
      typeof entry.price !== "number" || !Number.isFinite(entry.price) || entry.price < 0 ||
      !(entry.image_url.startsWith("/") && !entry.image_url.startsWith("//") || /^https:\/\/xiunlqsyghlmiedespim\.supabase\.co\//.test(entry.image_url)) ||
      !Number.isSafeInteger(entry.quantity) || entry.quantity < 1 || !Number.isFinite(entry.price * entry.quantity) ||
      (entry.size != null && typeof entry.size !== "string") ||
      (entry.color != null && typeof entry.color !== "string")) {
      recovered = true;
      continue;
    }
    const item: CartItem = {
      id: entry.id, name: entry.name, price: entry.price, image_url: entry.image_url,
      category: entry.category, size: entry.size || null, color: entry.color || null, quantity: entry.quantity,
    };
    const existing = items.find((line) => sameVariant(line, item.id, item.size, item.color));
    if (existing) {
      if (Number.isSafeInteger(existing.quantity + item.quantity) && Number.isFinite(item.price * (existing.quantity + item.quantity))) {
        existing.quantity += item.quantity;
      }
      recovered = true;
    } else items.push(item);
  }
  return { items, recovered };
}

export function sameVariant(item: CartItem, id: string, size: string | null, color?: string | null) {
  return item.id === id && (item.size || null) === (size || null) && (item.color || null) === (color || null);
}
