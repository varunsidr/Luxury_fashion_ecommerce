import { normalizeCatalogText, type Product } from "../productTypes";
import { configuredColors } from "./inventory";

export const FACT_TOPICS = ["overview", "material", "care", "fit", "measurements", "features", "price", "availability"] as const;
export type FactTopic = (typeof FACT_TOPICS)[number];
export const MATERIALS = ["cotton", "linen", "leather", "suede", "silk", "wool", "cashmere", "polyester", "nylon", "viscose", "elastane", "denim"];
export const FITS = ["relaxed", "oversized", "oversize", "slim", "regular", "straight", "wide-leg", "tailored"];

// Authored catalog text remains data. Reject instruction-bearing fields as a
// whole and quote only bounded topic-specific catalog excerpts, never model text.
function catalogText(value: string | null | undefined): string {
  if (typeof value !== "string" || !value || /[<>\u0000-\u0008\u202a-\u202e]|https?:|ignore.{0,50}instructions|system\s*prompt|api\s*key|reveal|developer\s*:|assistant\s*:|override|follow.{0,30}instructions/i.test(value)) return "";
  return value.replace(/\s+/g, " ").trim().slice(0, 1600);
}

const PATTERNS = {
  material: /\b(cotton|linen|leather|suede|silk|wool|cashmere|polyester|nylon|viscose|elastane|denim|composition|fabric|material)\b/i,
  care: /\b(wash|washing|dry.clean|bleach|iron|tumble|care|wipe|cleaning)\b/i,
  fit: /\b(fit|relaxed|oversize[d]?|slim|regular|straight|wide.leg|tailored|cut|silhouette)\b/i,
  measurements: /\b(cm|mm|inch|inches|waist|chest|length|width|height|measurement|model)\b/i,
  features: /\b(pocket|pockets|zip|zipper|button|buttons|lining|lined|closure|strap|straps|waterproof|water.resistant|hood|hooded)\b/i,
};

export interface ProductFact { text: string; source: "catalog" | "name" | "missing" }

export function productFact(product: Product, topic: keyof typeof PATTERNS, question = ""): ProductFact {
  const sources = topic === "measurements" ? [product.measurements, product.details, product.description]
    : topic === "material" || topic === "care" ? [product.compositionCare, product.details, product.description]
    : [product.details, product.description];
  const feature = question.match(/\b(waterproof|water.resistant|pockets?|lining|lined|zipper|zip|buttons?|hood(?:ed)?|straps?)\b/i)?.[0];
  const featurePattern = feature ? new RegExp("\\b" + feature.replace(/[ -]/g, "[ -]?").replace(/pockets?/, "pockets?").replace(/buttons?/, "buttons?") + "\\b", "i") : null;
  for (const source of sources) {
    const excerpts = catalogText(source).split(/(?<=[.!?;])\s+|\n/)
      .filter(sentence => PATTERNS[topic].test(sentence) && (topic !== "features" || !featurePattern || featurePattern.test(sentence)));
    if (excerpts.length) { const text = excerpts.join(" "); return { text: text.length > 320 ? text.slice(0, 319) + "…" : text, source: "catalog" }; }
  }
  if (topic === "material" || topic === "fit") {
    const words = topic === "material" ? MATERIALS : FITS;
    const names = words.filter(word => new RegExp("\\b" + word + "\\b", "i").test(catalogText(product.name)));
    if (names.length) return { text: `${names.join(", ")} mentioned in the product name; ${topic === "material" ? "full composition" : "fit measurements"} not listed`, source: "name" };
  }
  return { text: "Not listed", source: "missing" };
}

export function questionTopic(question: string): FactTopic | null {
  const text = normalizeCatalogText(question);
  if (/\b(material|fabric|composition|made (?:of|from)|cotton|linen|leather|silk|wool)\b/.test(text)) return "material";
  if (/\b(wash|washable|care|clean|cleaning|iron|bleach|tumble)\b/.test(text)) return "care";
  if (PATTERNS.fit.test(text) || /\b(fitting|true.to.size)\b/.test(text)) return "fit";
  if (/\b(measurement|measurements|length|width|height|waist|chest)\b/.test(text)) return "measurements";
  if (PATTERNS.features.test(text)) return "features";
  if (/\b(price|cost|how much)\b/.test(text)) return "price";
  if (/\b(first|second|third|this|that|it)\b.*\b(under|below|above|over)\s*(?:₹|\$|rs|inr|\d)/.test(text)) return "price";
  if (/\b(stock|available|availability|sizes?|colou?rs?)\b/.test(text)) return "availability";
  if (/\b(tell me (?:more|about)|details|describe)\b/.test(text)) return "overview";
  return null;
}

export function matchesMaterial(product: Product, wanted: string): boolean {
  const fact = productFact(product, "material");
  if (fact.source === "missing") return false;
  const text = normalizeCatalogText(fact.source === "name" ? product.name : fact.text), needle = normalizeCatalogText(wanted);
  // A negative declaration must not qualify as a positive material match.
  if (new RegExp(`\\b(?:no|not|without|non)[ -]+(?:\\w+ ){0,2}${needle}\\b|\\b${needle}[ -]+free\\b|(?:^|[^\\d.])0(?:\\.0+)?\\s*%\\s*${needle}\\b`).test(text)) return false;
  return new RegExp(`\\b${needle}\\b`).test(text);
}

export function matchesFit(product: Product, wanted: string): boolean {
  const fact = productFact(product, "fit");
  const text = normalizeCatalogText(fact.source === "name" ? product.name : fact.text).replaceAll("-", " "), needle = normalizeCatalogText(wanted).replaceAll("-", " ");
  return fact.source !== "missing" && !new RegExp(`\\b(?:no|not|without|non)[ -]+${needle}\\b`).test(text) && text.includes(needle);
}

export function matchesColor(product: Product, wanted: string): boolean {
  const canonical = (value: string) => normalizeCatalogText(value).replace(/\bgrey\b/g, "gray").replace(/[^a-z0-9]+/g, " ").trim();
  const needle = canonical(wanted);
  return configuredColors(product).some(color => canonical(color.name) === needle) ||
    (" " + canonical(product.name) + " ").includes(" " + needle + " ");
}
