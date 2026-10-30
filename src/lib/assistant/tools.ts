import { MAIN_CATEGORY_ALIASES, MAIN_CATEGORY_LABELS, getStorefrontSlugForCategory } from "../categories";
import { normalizeCatalogText, type Product } from "../productTypes";
import { POLICY_TOPICS, STORE_POLICIES } from "./policies";
import type { ProductCardData, ToolContext, ToolRunState } from "./types";
import { availableUnits, configuredSizes, configuredColors, cartAction, validVariant } from "./inventory";
import { assistantPrice, DEFAULT_DISPLAY } from "./presentation";

export const MAX_TOOL_RESULTS = 8;
const MAX_QUANTITY = 10;
const LOW_STOCK_THRESHOLD = 5;

export class ToolInputError extends Error {}

type Args = Record<string, unknown>;

const SORTS = ["relevance", "price_asc", "price_desc", "newest"] as const;
type Sort = (typeof SORTS)[number];

const str = (value: unknown, name: string, max: number, required = false): string | undefined => {
  if (value === undefined || value === null || value === "") {
    if (required) throw new ToolInputError(`${name} is required`);
    return undefined;
  }
  if (typeof value !== "string") throw new ToolInputError(`${name} must be a string`);
  const trimmed = value.trim();
  if (!trimmed && required) throw new ToolInputError(`${name} is required`);
  return trimmed.slice(0, max) || undefined;
};

const num = (value: unknown, name: string, min: number, max: number): number | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new ToolInputError(`${name} must be a number between ${min} and ${max}`);
  }
  return value;
};

const int = (value: unknown, name: string, min: number, max: number): number | undefined => {
  const parsed = num(value, name, min, max);
  if (parsed !== undefined && !Number.isInteger(parsed)) throw new ToolInputError(`${name} must be an integer`);
  return parsed;
};

const bool = (value: unknown, name: string): boolean | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "boolean") throw new ToolInputError(`${name} must be a boolean`);
  return value;
};

const asArgs = (value: unknown): Args => {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ToolInputError("arguments must be an object");
  return value as Args;
};

export const productUrl = (product: Pick<Product, "id" | "category">) =>
  `/${getStorefrontSlugForCategory(product.category)}/${encodeURIComponent(String(product.id))}`;

type Availability = "in_stock" | "low_stock" | "out_of_stock";

function availabilityOf(product: Product, size?: string | null): Availability {
  const units = availableUnits(product, size ?? null);
  if (units <= 0) return "out_of_stock";
  return units <= LOW_STOCK_THRESHOLD ? "low_stock" : "in_stock";
}

const isInStock = (product: Product) => availabilityOf(product) !== "out_of_stock";

export function toCard(product: Product): ProductCardData {
  if (!Number.isFinite(product.price) || product.price < 0) throw new Error("Catalog pricing unavailable");
  return {
    id: String(product.id), name: product.name, category: product.category, price: product.price,
    image_url: product.image_url, url: productUrl(product), inStock: isInStock(product),
    brand: product.brand ?? null,
    sizes: configuredSizes(product).map(size => ({ size, inStock: availableUnits(product, size) > 0 })),
    colors: configuredColors(product).map(color => color.name),
  };
}

function summarize(product: Product, state: ToolRunState) {
  const card = toCard(product);
  state.seenProducts.set(card.id, card);
  return {
    id: card.id, name: product.name, category: product.category, brand: product.brand ?? null,
    price_inr: product.price, tag: product.tag ?? null, availability: availabilityOf(product),
    colors: configuredColors(product).map((color) => color.name), url: card.url,
  };
}

function detail(product: Product, state: ToolRunState) {
  return {
    ...summarize(product, state),
    sizes: product.sizes ?? [],
    // Catalog text is authored content: untrusted data, never instructions.
    untrusted_description: (product.description ?? "").slice(0, 600),
    untrusted_details: (product.details ?? "").slice(0, 400),
    untrusted_composition_care: (product.compositionCare ?? "").slice(0, 300),
    untrusted_measurements: (product.measurements ?? "").slice(0, 300),
    untrusted_shipping_returns: (product.shippingReturns ?? "").slice(0, 300),
  };
}

function findProduct(products: Product[], idOrSlug: string): Product | undefined {
  const needle = idOrSlug.toLowerCase();
  return products.find((product) => String(product.id).toLowerCase() === needle ||
    String((product as { slug?: string }).slug ?? "").toLowerCase() === needle);
}

const STOP_WORDS = new Set(["a", "an", "the", "for", "me", "show", "find", "i", "want", "need", "some", "any", "with", "in", "of", "and", "to", "please", "something", "under", "below", "over", "than"]);

const tokens = (value: string) => normalizeCatalogText(value).split(/[^a-z0-9]+/)
  .filter((token) => token && !STOP_WORDS.has(token))
  .map((token) => /(?:ss|sh|ch|x|z)es$/.test(token) ? token.slice(0, -2)
    : token.length > 3 && token.endsWith("s") && !token.endsWith("ss") ? token.slice(0, -1) : token);

// Match whole words in product identity fields. Description prose can mention
// other garment types and must not make jeans an exact match for shorts.
function searchFields(product: Product): [Set<string>, number][] {
  return [
    [new Set(tokens(product.name)), 4], [new Set(tokens(product.category)), 3],
    [new Set(tokens(product.brand ?? "")), 2], [new Set(tokens(product.tag ?? "")), 1],
    [new Set(tokens(configuredColors(product).map((color) => color.name).join(" "))), 2],
  ];
}

function mainCategoryMatches(product: Product, wanted: string): boolean {
  const normalizedCategory = normalizeCatalogText(product.category);
  const normalizedWanted = normalizeCatalogText(wanted);
  const hasPrefix = (prefix: string) => normalizedCategory === prefix || normalizedCategory.startsWith(prefix + " ");
  // Normalization turns Women's into womens. Match a complete category prefix,
  // never a substring such as men inside womens.
  if ((" " + normalizedCategory + " ").includes(" " + normalizedWanted + " ")) return true;
  return Object.entries(MAIN_CATEGORY_ALIASES).some(([, aliases]) =>
    aliases.includes(normalizedWanted) && aliases.some(hasPrefix));
}

function searchMatch(product: Product, queryTokens: string[]) {
  const fields = searchFields(product);
  const descriptionWords = new Set(tokens(product.description ?? ""));
  let total = 0;
  let matched = 0;
  for (const token of queryTokens) {
    if (fields.some(([words]) => words.has(token))) matched++;
    for (const [words, weight] of fields) if (words.has(token)) total += weight;
    if (descriptionWords.has(token)) total++;
  }
  return { score: queryTokens.length ? total : 1, exact: matched === queryTokens.length };
}

async function searchProducts(args: Args, ctx: ToolContext, state: ToolRunState) {
  const query = str(args.query, "query", 200);
  const category = str(args.category, "category", 80);
  const color = str(args.color, "color", 40);
  const size = str(args.size, "size", 30);
  const display = ctx.display ?? DEFAULT_DISPLAY;
  const priceCurrency = str(args.priceCurrency, "priceCurrency", 3) ?? display.currency;
  if (priceCurrency !== "INR" && priceCurrency !== "USD") throw new ToolInputError("priceCurrency must be INR or USD");
  if (priceCurrency === "USD" && display.currency !== "USD") return { error: "currency_unavailable", message: "A dollar exchange rate is unavailable. Please give your budget in INR." };
  const rate = priceCurrency === "INR" ? 1 : display.rate;
  const minimum = num(args.minPrice, "minPrice", 0, 100_000_000);
  const maximum = num(args.maxPrice, "maxPrice", 0, 100_000_000);
  const minPrice = minimum === undefined ? undefined : minimum / rate;
  const maxPrice = maximum === undefined ? undefined : maximum / rate;
  const inStockOnly = bool(args.inStockOnly, "inStockOnly") ?? true;
  const sort = (str(args.sortBy, "sortBy", 20) ?? "relevance") as Sort;
  if (!SORTS.includes(sort)) throw new ToolInputError(`sortBy must be one of ${SORTS.join(", ")}`);
  const limit = int(args.limit, "limit", 1, MAX_TOOL_RESULTS) ?? 5;
  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) throw new ToolInputError("minPrice cannot exceed maxPrice");

  const queryTokens = query ? tokens(query) : [];
  let matches = (await ctx.store.listProducts())
    .filter((product) => Number.isFinite(product.price) && product.price >= 0)
    .filter((product) => !category || mainCategoryMatches(product, category))
    .filter((product) => minPrice === undefined || product.price >= minPrice)
    .filter((product) => maxPrice === undefined || product.price <= maxPrice)
    .filter((product) => !color || configuredColors(product).some((option) => normalizeCatalogText(option.name) === normalizeCatalogText(color)))
    .filter((product) => !size || configuredSizes(product).some((value) => normalizeCatalogText(value) === normalizeCatalogText(size)))
    .filter((product) => !inStockOnly || availabilityOf(product, size ? configuredSizes(product).find(value => normalizeCatalogText(value) === normalizeCatalogText(size)) : null) !== "out_of_stock")
    .map((product) => ({ product, ...searchMatch(product, queryTokens) }))
    .filter((entry) => entry.score > 0);

  const exactMatches = matches.filter((entry) => entry.exact);
  const matchType = exactMatches.length ? "exact" : matches.length ? "similar" : "none";
  // Only relax keyword matching; explicit budget, category, size, color and
  // stock filters above still apply to every alternative.
  if (exactMatches.length) matches = exactMatches;

  matches = matches.sort((a, b) => {
    if (sort === "price_asc") return a.product.price - b.product.price;
    if (sort === "price_desc") return b.product.price - a.product.price;
    if (sort === "newest") return String(b.product.created_at ?? "").localeCompare(String(a.product.created_at ?? ""));
    return b.score - a.score || a.product.price - b.product.price;
  });

  const page = matches.slice(0, limit).map((entry) => entry.product);
  state.lastProductIds = page.map((product) => String(product.id));
  state.sections.set("search", matchType === "exact" ? "Here are matching products. Prices and available options are shown on the cards."
    : matchType === "similar" ? `I couldn't find an exact match for “${query}” with your filters. Here are some similar products you may like. Prices and available options are shown on the cards.`
    : "No products matched those filters. Try a different category, budget, size or color.");
  return {
    total_matches: matches.length,
    exact_matches: exactMatches.length,
    match_type: matchType,
    note: color ? "Color filtering only covers products that list color options." : undefined,
    products: page.map((product) => summarize(product, state)),
  };
}

async function getProduct(args: Args, ctx: ToolContext, state: ToolRunState) {
  const idOrSlug = str(args.productIdOrSlug, "productIdOrSlug", 100, true)!;
  const product = findProduct(await ctx.store.listProducts(), idOrSlug);
  if (!product) return { found: false, message: "No product with that id or slug exists." };
  state.lastProductIds = [String(product.id)];
  state.sections.set("details", "Here are the catalog details. Open a product page for its description and size guide.");
  return { found: true, product: detail(product, state) };
}

async function getProductAvailability(args: Args, ctx: ToolContext, state: ToolRunState) {
  const id = str(args.productId, "productId", 100, true)!;
  const product = findProduct(await ctx.store.listProducts(), id);
  if (!product) return { found: false, message: "No product with that id exists." };
  const sizes = configuredSizes(product);
  summarize(product, state);
  state.lastProductIds = [String(product.id)];
  state.sections.set(`availability:${product.id}`, `${product.name}: ${availabilityOf(product).replaceAll("_", " ")}.${sizes.length
    ? " Sizes: " + sizes.map(size => `${size}: ${availabilityOf(product, size).replaceAll("_", " ")}`).join("; ") + "." : ""}`);
  return {
    found: true, productId: String(product.id), availability: availabilityOf(product),
    sizes: sizes.length ? sizes.map((size) => ({ size, availability: availabilityOf(product, size) })) : undefined,
    note: "Exact quantities and delivery dates are not shared.",
  };
}

async function getRelatedProducts(args: Args, ctx: ToolContext, state: ToolRunState) {
  const id = str(args.productId, "productId", 100, true)!;
  const limit = int(args.limit, "limit", 1, MAX_TOOL_RESULTS) ?? 4;
  const products = await ctx.store.listProducts();
  const base = findProduct(products, id);
  if (!base) return { found: false, message: "No product with that id exists." };
  const baseTokens = new Set(tokens(base.name));
  const related = products
    .filter((product) => String(product.id) !== String(base.id) && isInStock(product))
    .map((product) => ({
      product,
      score: (product.category === base.category ? 10 : 0) +
        tokens(product.name).filter((token) => baseTokens.has(token)).length * 2 +
        (product.brand && product.brand === base.brand ? 1 : 0) -
        Math.abs(product.price - base.price) / Math.max(base.price, 1),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.product);
  state.lastProductIds = related.map((product) => String(product.id));
  state.sections.set("related", related.length ? "Here are similar products from the catalog." : "No similar in-stock products were found. Try browsing the category.");
  return { found: true, products: related.map((product) => summarize(product, state)) };
}

async function getCategories(_args: Args, ctx: ToolContext, state: ToolRunState) {
  const groups = new Map<string, { name: string; url: string; product_count: number; subcategories: Set<string> }>();
  for (const product of await ctx.store.listProducts()) {
    const slug = getStorefrontSlugForCategory(product.category);
    const main = MAIN_CATEGORY_LABELS[slug.charAt(0).toUpperCase() + slug.slice(1)] ?? slug;
    const group = groups.get(slug) ?? { name: main, url: `/${slug}`, product_count: 0, subcategories: new Set<string>() };
    group.product_count += 1;
    if (normalizeCatalogText(product.category) !== normalizeCatalogText(main)) group.subcategories.add(product.category);
    groups.set(slug, group);
  }
  state.sections.set("categories", groups.size ? "Browse: " + [...groups.values()].map(group => `${group.name} (${group.product_count})`).join(", ") + "." : "No catalog categories were found.");
  return { categories: [...groups.values()].map((group) => ({ ...group, subcategories: [...group.subcategories].sort() })) };
}

async function getCart(_args: Args, ctx: ToolContext, state: ToolRunState) {
  if (!ctx.authenticated) return { error: "sign_in_required", message: "The shopper is not signed in, so the cart cannot be read." };
  if (!ctx.cart.length) {
    state.sections.set("cart", "Your bag is empty.");
    return { items: [], total_inr: 0, message: "The cart is empty." };
  }
  const products = await ctx.store.listProducts();
  let total = 0;
  const items = ctx.cart.map((line) => {
    const product = findProduct(products, line.id);
    if (!product) return { id: line.id, status: "no_longer_listed", size: line.size, color: line.color, quantity: line.quantity };
    const lineTotal = product.price * line.quantity;
    total += lineTotal;
    state.seenProducts.set(String(product.id), toCard(product));
    return {
      id: String(product.id), name: product.name, size: line.size, color: line.color, quantity: line.quantity,
      unit_price_inr: product.price, line_total_inr: lineTotal, availability: availabilityOf(product, line.size), url: productUrl(product),
    };
  });
  state.sections.set("cart", items.map(item => "name" in item
    ? `${item.quantity} × ${item.name}${item.size ? `, size ${item.size}` : ""}${item.color ? `, ${item.color}` : ""}: ${assistantPrice(item.line_total_inr!, ctx.display)}.`
    : `${item.quantity} × an item that is no longer listed.`).join("\n") + `\nCatalog total: ${assistantPrice(total, ctx.display)}. Check your bag before checkout.`);
  return { items, total_inr: total, note: "Prices come from the current catalog and may differ from what the browser stored." };
}

// Weak heuristic only; the real safeguard is the Confirm button, which the shopper must press.
const CONFIRM_INTENT = /\b(add|put|buy|get|order|take|want|yes|yep|sure|confirm|go ahead|please do)\b/i;

async function addToCart(args: Args, ctx: ToolContext, state: ToolRunState) {
  if (!ctx.authenticated) return { error: "sign_in_required", message: "The shopper must sign in before items can be added to the bag." };
  if (bool(args.userExplicitlyAskedToAdd, "userExplicitlyAskedToAdd") !== true || !CONFIRM_INTENT.test(ctx.lastUserMessage)) {
    return { error: "intent_not_confirmed", message: "Ask the shopper whether they want this item added; do not propose it yet." };
  }
  const productId = str(args.productId, "productId", 100, true)!;
  const size = str(args.size, "size", 30) ?? null;
  const color = str(args.color, "color", 40) ?? null;
  const quantity = int(args.quantity, "quantity", 1, MAX_QUANTITY) ?? 1;
  const product = findProduct(await ctx.store.listProducts(), productId);
  if (!product) return { error: "not_found", message: "No product with that id exists." };
  summarize(product, state);
  state.lastProductIds = [String(product.id)];

  const sizes = configuredSizes(product);
  let chosenSize = size;
  if (sizes.length) {
    chosenSize = sizes.find((value) => normalizeCatalogText(value) === normalizeCatalogText(size)) ?? null;
    if (!chosenSize) return { error: "size_required", message: "Ask the shopper to choose a size.", available_sizes: sizes };
  } else if (size) return { error: "invalid_option", message: "This product does not offer sizes." };
  let chosenColor = color;
  const colors = configuredColors(product);
  if (colors.length) {
    chosenColor = colors.find((option) => normalizeCatalogText(option.name) === normalizeCatalogText(color))?.name ?? null;
    if (!chosenColor) return { error: "color_required", message: "Ask the shopper to choose a color.", available_colors: colors.map((option) => option.name) };
  } else if (color) return { error: "invalid_option", message: "This product does not offer selectable colors." };

  const units = availableUnits(product, chosenSize);
  const inBag = ctx.cart.filter(line => line.id === String(product.id) && line.size === chosenSize).reduce((sum, line) => sum + line.quantity, 0);
  if (!validVariant(product, chosenSize, chosenColor) || units < quantity + inBag) return { error: "insufficient_stock", message: "That variant is out of stock or has fewer units than requested, including items already in the bag." };

  const action = cartAction(product, chosenSize, chosenColor, quantity);
  state.actions = [action];
  state.sections.set("proposal", "Review the selected options below, then press Confirm to add to your bag. Nothing has been added yet.");
  state.seenProducts.set(action.productId, toCard(product));
  return {
    status: "awaiting_user_confirmation",
    message: "A confirmation card is now shown to the shopper. Nothing was added yet. Ask them to press Confirm.",
    proposal: { name: product.name, size: chosenSize, color: chosenColor, quantity, unit_price_inr: product.price },
  };
}

function getStorePolicies(args: Args, _ctx: ToolContext, state: ToolRunState) {
  const topic = (str(args.topic, "topic", 40) ?? "all").toLowerCase();
  if (!(POLICY_TOPICS as readonly string[]).includes(topic)) {
    return { found: false, message: `No published information for that topic. Known topics: ${POLICY_TOPICS.join(", ")}.` };
  }
  const entries = topic === "all" ? Object.values(STORE_POLICIES) : [STORE_POLICIES[topic]];
  for (const entry of entries) state.sections.set(`policy:${entry.topic}`, entry.summary.join(" "));
  return { found: true, policies: entries };
}

type Handler = (args: Args, ctx: ToolContext, state: ToolRunState) => Promise<unknown> | unknown;

const handlers: Record<string, Handler> = {
  searchProducts, getProduct, getProductAvailability, getRelatedProducts, getCategories, getCart, addToCart, getStorePolicies,
};

export const TOOL_NAMES = Object.keys(handlers);

const obj = (properties: Record<string, unknown>, required: string[] = []) => ({
  type: "object", properties, required, additionalProperties: false,
});

export const TOOL_DEFINITIONS = [
  { type: "function" as const, name: "searchProducts", strict: false,
    description: "Search the store catalog. Preserve all requested product keywords in query; do not drop a missing garment type to force a match. Returns exact matches first, or clearly labeled similar alternatives when no exact match exists; at most 8 products. Budget filters use the shopper's display currency unless priceCurrency is specified. Returned price_inr is always INR.",
    parameters: obj({
      query: { type: "string", description: "Keywords such as 'black dress' or 'leather bag'." },
      category: { type: "string", description: "Main category: women, men, perfume, shoes, bags, accessories, makeup, or a sub-category name." },
      minPrice: { type: "number" }, maxPrice: { type: "number", description: "Maximum price in priceCurrency, defaulting to the shopper's display currency." },
      priceCurrency: { type: "string", enum: ["INR", "USD"], description: "Set INR for an explicit rupee/INR budget; USD for a dollar/USD budget. Otherwise omit to use display currency. Do not convert the amount yourself." },
      color: { type: "string" }, size: { type: "string" },
      inStockOnly: { type: "boolean", description: "Defaults to true." },
      sortBy: { type: "string", enum: [...SORTS] }, limit: { type: "integer", minimum: 1, maximum: MAX_TOOL_RESULTS },
    }) },
  { type: "function" as const, name: "getProduct", strict: false, description: "Get details for one product by id or slug.",
    parameters: obj({ productIdOrSlug: { type: "string" } }, ["productIdOrSlug"]) },
  { type: "function" as const, name: "getProductAvailability", strict: false, description: "Stock status (in_stock, low_stock, out_of_stock), per size when sizes exist.",
    parameters: obj({ productId: { type: "string" } }, ["productId"]) },
  { type: "function" as const, name: "getRelatedProducts", strict: false, description: "Find products similar to a given product.",
    parameters: obj({ productId: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: MAX_TOOL_RESULTS } }, ["productId"]) },
  { type: "function" as const, name: "getCategories", strict: false, description: "List store categories with product counts and page URLs.", parameters: obj({}) },
  { type: "function" as const, name: "getCart", strict: false, description: "Read the signed-in shopper's own cart (bag). Fails if not signed in.", parameters: obj({}) },
  { type: "function" as const, name: "addToCart", strict: false,
    description: "Propose adding an item to the shopper's bag. This does NOT modify the cart; it shows a Confirm button. Call only after the shopper clearly asked to add a specific product.",
    parameters: obj({
      productId: { type: "string" }, size: { type: "string" }, color: { type: "string" },
      quantity: { type: "integer", minimum: 1, maximum: MAX_QUANTITY },
      userExplicitlyAskedToAdd: { type: "boolean", description: "True only if the shopper's latest message explicitly asks to add this item." },
    }, ["productId", "userExplicitlyAskedToAdd"]) },
  { type: "function" as const, name: "getStorePolicies", strict: false, description: "Published store information on shipping, returns, payment, orders and sizing.",
    parameters: obj({ topic: { type: "string", enum: [...POLICY_TOPICS] } }) },
];

/** Validates arguments; failures become safe JSON, while cancellation stops the run. */
export async function executeTool(name: string, rawArguments: string, ctx: ToolContext, state: ToolRunState): Promise<string> {
  const handler = Object.hasOwn(handlers, name) ? handlers[name] : undefined;
  if (!handler) return JSON.stringify({ error: "unknown_tool" });
  try {
    let parsed: unknown = {};
    if (rawArguments && rawArguments.length > 4000) throw new ToolInputError("arguments too large");
    if (rawArguments) {
      try { parsed = JSON.parse(rawArguments); } catch { throw new ToolInputError("arguments must be valid JSON"); }
    }
    const result = await handler(asArgs(parsed), ctx, state);
    const status = result as { error?: string; found?: boolean; message?: string };
    if (status.error || status.found === false) {
      const notices: Record<string, string> = {
        sign_in_required: "Please sign in before reading or adding to your bag.",
        intent_not_confirmed: "Choose a product and ask to add it to your bag.",
        size_required: "Choose an available size on the product card, then review the bag addition.",
        color_required: "Choose a color on the product card, then review the bag addition.",
        insufficient_stock: "There is not enough stock for that variant and quantity, including items already in your bag.",
        invalid_option: "Those options are not offered. Choose the options shown on the product card.",
        currency_unavailable: "A dollar exchange rate is unavailable. Please give your budget in INR.",
      };
      state.sections.set("notice", notices[status.error ?? ""] ?? "That information could not be found. Try another product or store-policy topic.");
    }
    return JSON.stringify(result);
  } catch (error) {
    if (error instanceof ToolInputError) {
      state.sections.set("notice", "I couldn't use those search or product options. Please try a simpler request.");
      return JSON.stringify({ error: "invalid_arguments", message: error.message });
    }
    if (ctx.signal?.aborted) throw error;
    state.sections.set("notice", "This lookup is temporarily unavailable. Please try again or browse the store.");
    console.error("[assistant] tool failed", { tool: name, error: error instanceof Error ? error.name : "unknown" });
    return JSON.stringify({ error: "tool_unavailable", message: "This lookup is temporarily unavailable. Tell the shopper you could not retrieve it." });
  }
}

export function newRunState(): ToolRunState {
  return { seenProducts: new Map(), lastProductIds: [], actions: [], sections: new Map() };
}
