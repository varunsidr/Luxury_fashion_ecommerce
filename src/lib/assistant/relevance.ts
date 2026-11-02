import { normalizeCatalogText, type Product } from "../productTypes";

const STOP_WORDS = new Set(["a", "an", "the", "for", "me", "show", "find", "i", "want", "need", "some", "any", "with", "in", "of", "and", "to", "please", "something", "under", "below", "over", "than", "do", "you", "have", "looking", "im", "product", "products"]);

export function catalogTokens(value: string): string[] {
  return normalizeCatalogText(value)
    // Sleeve length is an attribute of a top, never evidence that it is shorts.
    .replace(/\bshort[\s-]+sleeve(?:d)?\b/g, "shortsleeve")
    .split(/[^a-z0-9]+/).filter(token => token && !STOP_WORDS.has(token))
    .map(token => /(?:ss|sh|ch|x|z)es$/.test(token) ? token.slice(0, -2)
      : token.length > 3 && token.endsWith("s") && !token.endsWith("ss") ? token.slice(0, -1) : token)
    .map(token => ["pant", "slack"].includes(token) ? "trouser" : token);
}

const TYPES = [
  { label: "dress", family: "dress", words: ["dress", "gown"] },
  { label: "shirt", family: "top", words: ["shirt", "overshirt", "blouse", "top", "tshirt", "tee"] },
  { label: "jacket", family: "outerwear", words: ["jacket", "coat", "blazer"] },
  { label: "suit", family: "suit", words: ["suit", "tuxedo"] },
  { label: "shorts", family: "bottoms", words: ["short", "bermuda"] },
  { label: "jeans", family: "bottoms", words: ["jean"] },
  { label: "trousers", family: "bottoms", words: ["trouser", "chino", "jogger", "legging"] },
  { label: "skirt", family: "skirt", words: ["skirt"] },
  { label: "shoes", family: "footwear", words: ["shoe", "sneaker", "boot", "loafer", "sandal", "heel", "pump"] },
  { label: "bag", family: "bag", words: ["bag", "tote", "crossbody", "clutch", "backpack", "satchel", "hobo"] },
  { label: "perfume", family: "fragrance", words: ["perfume", "fragrance", "cologne"] },
  { label: "makeup", family: "makeup", words: ["makeup", "lipstick", "mascara", "blush", "concealer", "bronzer"] },
  { label: "accessory", family: "accessory", words: ["accessory", "accessorie", "watch", "belt", "scarf", "necklace", "earring", "bracelet", "ring", "sunglasse"] },
] as const;
type ProductType = (typeof TYPES)[number];
const TYPE_WORDS = new Set<string>(TYPES.flatMap(type => [...type.words]));
const AUDIENCE_WORDS = new Set(["men", "man", "male", "women", "woman", "ladie", "female", "unisex"]);

const typeOf = (words: string[]) => TYPES.find(type => type.words.some(word => words.includes(word)));
const productType = (product: Product) => typeOf(catalogTokens(product.name)) ?? typeOf(catalogTokens(product.category));
const audience = (words: string[]) => words.some(word => ["women", "woman", "ladie", "female"].includes(word)) ? "women"
  : words.some(word => ["men", "man", "male"].includes(word)) ? "men" : null;
const productAudience = (product: Product) => audience(catalogTokens(product.category + " " + product.name));

function identityFields(product: Product): [Set<string>, number][] {
  return [
    [new Set(catalogTokens(product.name)), 4], [new Set(catalogTokens(product.category)), 3],
    [new Set(catalogTokens(product.brand ?? "")), 2], [new Set(catalogTokens(product.tag ?? "")), 1],
    [new Set(catalogTokens((product.color_options ?? []).map(color => color.name).join(" "))), 2],
  ];
}

export interface SearchIntent {
  words: string[];
  type?: ProductType;
  audience: "men" | "women" | null;
  distinctive: string[];
}

export function searchIntent(query: string): SearchIntent {
  const words = [...new Set(catalogTokens(query))];
  return { words, type: typeOf(words), audience: audience(words), distinctive: words.filter(word => !TYPE_WORDS.has(word) && !AUDIENCE_WORDS.has(word)) };
}

export function assessSearchMatch(product: Product, intent: SearchIntent) {
  const fields = identityFields(product);
  const has = (word: string) => fields.some(([words]) => words.has(word));
  const type = productType(product);
  const matches = intent.words.filter(has);
  const distinctiveMatches = intent.distinctive.filter(has);
  const sameType = type?.label === intent.type?.label;
  const sameFamily = type?.family === intent.type?.family;
  const gender = productAudience(product);
  const compatibleAudience = !intent.audience || !gender || intent.audience === gender;
  // Partial descriptions/brand overlap cannot turn an unrelated garment into a
  // substitute. Sibling garments also need a requested distinguishing feature.
  const relevant = compatibleAudience && (!intent.type
    ? !intent.words.length || matches.length > 0
    : Boolean(type && (sameType || sameFamily && (!intent.distinctive.length || distinctiveMatches.length > 0))));
  const description = new Set(catalogTokens(product.description ?? ""));
  const score = (intent.type ? sameType ? 1000 : sameFamily ? 500 : 0 : 0) + distinctiveMatches.length * 50 +
    intent.words.reduce((sum, word) => sum + fields.reduce((value, [words, weight]) => value + (words.has(word) ? weight : 0), 0) + (description.has(word) ? 1 : 0), 0);
  const exact = relevant && matches.length === intent.words.length && (!intent.type || sameType);
  const reason = intent.type && type && !sameType
    ? `${distinctiveMatches.length ? `Matches “${distinctiveMatches.join(", ")}”; ` : ""}${type.label} instead of ${intent.type.label}.`
    : matches.length ? `Matches “${matches.join(", ")}”.` : undefined;
  return { relevant, exact, score, reason, matchedDistinctiveCount: distinctiveMatches.length };
}

export function assessRelatedMatch(product: Product, base: Product) {
  const type = productType(base), candidateType = productType(product);
  const baseAudience = productAudience(base), candidateAudience = productAudience(product);
  if (baseAudience && candidateAudience && baseAudience !== candidateAudience) return { relevant: false, score: 0 };
  const sameCategory = normalizeCatalogText(product.category) === normalizeCatalogText(base.category);
  if (type && candidateType?.family !== type.family || !type && !sameCategory) return { relevant: false, score: 0 };
  const shared = catalogTokens(base.name).filter(word => catalogTokens(product.name).includes(word)).length;
  return { relevant: true, score: (candidateType?.label === type?.label ? 1000 : 500) + (sameCategory ? 100 : 0) + shared * 10 - Math.abs(product.price - base.price) / Math.max(base.price, 1) };
}
