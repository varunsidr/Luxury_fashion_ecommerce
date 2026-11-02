import type { AssistantDisplay, ChatMessage, ShoppingPreferences } from "./types";
import { MATERIALS, FITS, questionTopic } from "./productFacts";
import { normalizeCatalogText } from "../productTypes";
import { searchIntent } from "./relevance";

const KEYS = ["query", "category", "audience", "minPrice", "maxPrice", "priceCurrency", "color", "size", "material", "fit", "inStockOnly", "excludeColors", "excludeMaterials", "excludeFits"] as const;
const COLORS = ["black", "white", "red", "blue", "green", "brown", "beige", "navy", "gray", "grey", "pink", "cream", "ivory", "burgundy"];
export const EMPTY_PREFERENCES: ShoppingPreferences = Object.fromEntries(KEYS.map(key => [key, null]));

export function parsePreferences(value: unknown): ShoppingPreferences | null {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(key => !(KEYS as readonly string[]).includes(key))) return null;
  const parsed: ShoppingPreferences = {};
  for (const key of KEYS) {
    const item = (value as Record<string, unknown>)[key];
    if (item === undefined) continue;
    if (item === null) { Object.assign(parsed, { [key]: null }); continue; }
    if (key === "excludeColors" || key === "excludeMaterials" || key === "excludeFits") {
      const allowed = key === "excludeColors" ? COLORS : key === "excludeFits" ? FITS : MATERIALS;
      if (!Array.isArray(item) || item.length > 6 || new Set(item).size !== item.length || item.some(value => typeof value !== "string" || !allowed.includes(value))) return null;
      Object.assign(parsed, { [key]: [...item] }); continue;
    }
    if (key === "minPrice" || key === "maxPrice") {
      if (typeof item !== "number" || !Number.isFinite(item) || item < 0 || item > 100_000_000) return null;
    } else if (key === "priceCurrency") { if (item !== "INR" && item !== "USD") return null; }
    else if (key === "audience") { if (item !== "men" && item !== "women") return null; }
    else if (key === "inStockOnly") { if (typeof item !== "boolean") return null; }
    else if (typeof item !== "string" || !item.trim() || item.length > (key === "query" ? 200 : key === "size" ? 30 : key === "category" ? 80 : 40)) return null;
    if (key === "material" && !MATERIALS.includes(item as string) || key === "fit" && !FITS.includes(item as string)) return null;
    Object.assign(parsed, { [key]: typeof item === "string" ? item.trim() : item });
  }
  if (parsed.minPrice != null && parsed.maxPrice != null && parsed.minPrice > parsed.maxPrice) return null;
  return parsed;
}

export function clearsPreferences(message: string): boolean {
  return /\b(?:clear|forget|reset) (?:all |my |the )?(?:shopping )?(?:preferences|filters)\b/i.test(message);
}

export function refinePreferences(previous: ShoppingPreferences, message: string, display: AssistantDisplay): ShoppingPreferences {
  if (clearsPreferences(message)) return { ...EMPTY_PREFERENCES };
  const next = { ...previous };
  // Product questions refer to facts, not new shopping constraints.
  if (/\b(?:compare|comparison|difference|which.*(?:cheaper|better|expensive))\b/i.test(message)) return next;
  const topic = questionTopic(message);
  if (/\?|\b(?:what|does|is (?:it|this|that)|how|tell me)\b/i.test(message) && topic &&
    (/\b(first|second|third|it|this|that|one|ones|these|those|their)\b/i.test(message) || ["care", "measurements", "features", "price", "availability"].includes(topic) || /^what (?:(?:is|are) (?:the )?)?(?:material|fabric|composition|fit)\b/i.test(message))) return next;
  const text = normalizeCatalogText(message).replace(/\bwide leg\b/g, "wide-leg");
  const product = text.match(/\b(?:(?:mens|womens|men|women)\s+)?(?:(?:cargo|linen|cotton|leather|silk|wool|relaxed|slim|wide[ -]leg|oversized)\s+)*(?:shorts?|pants|trousers|jeans|shirts?|dresses|dress|blouses?|jackets?|coats?|suits?|skirts?|bags?|totes?|shoes|boots|sneakers|perfume|lipstick)\b/);
  if (product && !/\b(?:add|compare|similar to|about|made of)\b/.test(text)) {
    const oldFamily = previous.query ? searchIntent(previous.query).type?.family : undefined;
    const newFamily = searchIntent(product[0]).type?.family;
    if (oldFamily && newFamily !== oldFamily) { next.size = null; next.material = null; next.fit = null; }
    next.query = product[0].replace(new RegExp(`\\b(?:${[...MATERIALS, ...FITS, "mens", "womens", "men", "women"].join("|")})\\b`, "g"), "").replace(/\s+/g, " ").trim();
    if (oldFamily && newFamily !== oldFamily) next.category = null;
  }
  if (/\b(?:unisex|any gender|clear audience)\b/.test(text)) next.audience = null;
  else if (/\b(?:women|womens|ladies)\b/.test(text)) next.audience = "women";
  else if (/\b(?:men|mens)\b/.test(text)) next.audience = "men";
  if (/\b(?:no budget|any price|remove (?:the )?budget|no price limit)\b/.test(text)) {
    next.minPrice = null; next.maxPrice = null; next.priceCurrency = null;
  } else {
    const budget = text.match(/\b(under|below|up to|within|budget(?: is| of)?|above|over|at least)\s*(₹|rs\.?|inr|\$|usd)?\s*([\d,]+(?:\.\d+)?)(k)?\s*(rupees|inr|usd|dollars)?\b/);
    if (budget) {
      const amount = Number(budget[3].replaceAll(",", "")) * (budget[4] ? 1000 : 1);
      if (Number.isFinite(amount) && amount >= 0 && amount <= 100_000_000) {
        next.priceCurrency = /₹|rs|inr|rupees/.test((budget[2] ?? "") + (budget[5] ?? "")) ? "INR" : /\$|usd|dollars/.test((budget[2] ?? "") + (budget[5] ?? "")) ? "USD" : display.currency;
        if (["above", "over", "at least"].includes(budget[1])) { next.minPrice = amount; if (next.maxPrice != null && amount > next.maxPrice) next.maxPrice = null; }
        else { next.maxPrice = amount; if (next.minPrice != null && amount < next.minPrice) next.minPrice = null; }
      }
    }
  }
  const negated = (value: string) => new RegExp(`\\b(?:not|no|avoid|without|except|exclude)\\s+(?:any\\s+)?${value}\\b|\\b${value}[ -]free\\b`).test(text);
  const excludedColors = COLORS.filter(value => negated(value));
  const excludedMaterials = MATERIALS.filter(value => negated(value));
  const excludedFits = FITS.filter(value => negated(value));
  if (excludedColors.length) { next.excludeColors = [...new Set([...(next.excludeColors ?? []), ...excludedColors])].slice(-6); if (next.color && excludedColors.includes(next.color)) next.color = null; }
  if (excludedMaterials.length) { next.excludeMaterials = [...new Set([...(next.excludeMaterials ?? []), ...excludedMaterials])].slice(-6); if (next.material && excludedMaterials.includes(next.material)) next.material = null; }
  if (excludedFits.length) { next.excludeFits = [...new Set([...(next.excludeFits ?? []), ...excludedFits])].slice(-6); if (next.fit && excludedFits.includes(next.fit)) next.fit = null; }
  const color = COLORS.find(value => !negated(value) && new RegExp(`\\b${value}\\b`).test(text));
  if (/\b(?:any colou?r|clear colou?r|no colou?r preference)\b/.test(text)) next.color = null;
  else if (color) { next.color = color; next.excludeColors = next.excludeColors?.filter(value => value !== color); }
  const size = text.match(/\bsize\s+(xxs|xs|s|m|l|xl|xxl|\d{1,2})\b/i);
  if (/\b(?:any size|clear size)\b/.test(text)) next.size = null;
  else if (size) next.size = size[1].toUpperCase();
  if (/\b(?:any material|any fabric|clear material)\b/.test(text)) next.material = null;
  else { const material = MATERIALS.find(value => !negated(value) && new RegExp(`\\b${value}\\b`).test(text)); if (material) { next.material = material; next.excludeMaterials = next.excludeMaterials?.filter(value => value !== material); } }
  if (/\b(?:any fit|clear fit)\b/.test(text)) next.fit = null;
  else { const fit = FITS.find(value => !negated(value) && new RegExp(`\\b${value}\\b`).test(text)); if (fit) { next.fit = fit; next.excludeFits = next.excludeFits?.filter(value => value !== fit); } }
  if (/\b(?:include sold.out|include out.of.stock)\b/.test(text)) next.inStockOnly = false;
  else if (/\b(?:in.stock only|only in.stock)\b/.test(text)) next.inStockOnly = true;
  return next;
}

export function conversationPreferences(messages: ChatMessage[], seed: ShoppingPreferences | undefined, display: AssistantDisplay, interaction = false) {
  const previous = seed ?? messages.slice(0, -1).filter(message => message.role === "user").reduce((value, message) => refinePreferences(value, message.content, display), {} as ShoppingPreferences);
  const preferences = interaction ? { ...previous } : refinePreferences(previous, messages.at(-1)!.content, display);
  return { preferences, changed: JSON.stringify(previous) !== JSON.stringify(preferences) };
}

export function preferenceLabels(preferences: ShoppingPreferences): string[] {
  const money = (amount: number) => new Intl.NumberFormat(preferences.priceCurrency === "USD" ? "en-US" : "en-IN", { style: "currency", currency: preferences.priceCurrency ?? "INR", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amount);
  return [preferences.query, preferences.category, preferences.audience, preferences.minPrice != null ? `From ${money(preferences.minPrice)}` : null,
    preferences.maxPrice != null ? `Up to ${money(preferences.maxPrice)}` : null, preferences.color,
    preferences.size ? `Size ${preferences.size}` : null, preferences.material, preferences.fit,
    preferences.inStockOnly === true ? "In stock only" : preferences.inStockOnly === false ? "Include sold out" : null,
    ...(preferences.excludeColors ?? []).map(value => `Exclude listed ${value}`), ...(preferences.excludeMaterials ?? []).map(value => `Exclude listed ${value}`),
    ...(preferences.excludeFits ?? []).map(value => `Exclude listed ${value}`)].filter((value): value is string => Boolean(value));
}
