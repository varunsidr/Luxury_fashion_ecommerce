import type { Product } from "../productTypes";
import { availableUnits, configuredColors, configuredSizes } from "./inventory";
import { assistantPrice } from "./presentation";
import { productFact, type FactTopic } from "./productFacts";
import type { ProductComparison, ToolContext } from "./types";

function factText(product: Product, topic: "material" | "care" | "fit" | "measurements" | "features", question = "") {
  const fact = productFact(product, topic, question);
  return fact.source === "catalog" ? `Catalog: ${fact.text}` : fact.text;
}

const stockText = (product: Product) => availableUnits(product, null) > 0 ? "In stock" : "Out of stock";
const sizeText = (product: Product) => configuredSizes(product).map(size => `${size}${availableUnits(product, size) > 0 ? "" : " (out of stock)"}`).join(", ") || "No size selection";
const colorText = (product: Product) => configuredColors(product).map(color => color.name).join(", ") || "No selectable colors";

export function productAnswer(product: Product, topic: FactTopic, question: string, ctx: ToolContext): string {
  if (topic === "price") return `${product.name}: ${assistantPrice(product.price, ctx.display)} at the current catalog price.`;
  if (topic === "availability") return `${product.name}: ${stockText(product)}.\nSizes: ${sizeText(product)}.\nColors: ${colorText(product)}. Stock is checked again before adding and at checkout.`;
  if (topic === "overview") {
    return `${product.name} — ${assistantPrice(product.price, ctx.display)}. ${stockText(product)}.\n` +
      (["material", "fit", "care"] as const).map(field => `${field[0].toUpperCase() + field.slice(1)}: ${factText(product, field)}.`).join("\n") +
      `\nSizes: ${sizeText(product)}. Colors: ${colorText(product)}.`;
  }
  const fact = productFact(product, topic, question);
  const label = { material: "Material", care: "Care", fit: "Fit", measurements: "Measurements", features: "Requested feature" }[topic];
  return fact.source === "missing"
    ? `${product.name}: ${label.toLowerCase()} information isn't listed in the catalog. I can't confirm it from the product name or photo. Check the product page or product label before deciding.`
    : `${product.name}\n${label}: ${fact.source === "catalog" ? "The catalog lists: “" + fact.text + "”" : fact.text}.`;
}

export function productComparison(products: Product[], ctx: ToolContext): { comparison: ProductComparison; summary: string } {
  const rows = [
    { label: "Price", values: products.map(product => assistantPrice(product.price, ctx.display)) },
    { label: "Material", values: products.map(product => factText(product, "material")) },
    { label: "Fit", values: products.map(product => factText(product, "fit")) },
    { label: "Care", values: products.map(product => factText(product, "care")) },
    { label: "Available options", values: products.map(product => `${sizeText(product)}; ${colorText(product)}`) },
    { label: "Stock", values: products.map(stockText) },
  ];
  if (new Set(products.map(product => product.category)).size > 1) rows.splice(1, 0, { label: "Category", values: products.map(product => product.category) });
  if (products.some(product => productFact(product, "measurements").source !== "missing")) rows.push({ label: "Measurements", values: products.map(product => factText(product, "measurements")) });
  if (ctx.preferences?.size) rows.push({ label: `Your size: ${ctx.preferences.size}`, values: products.map(product => configuredSizes(product).includes(ctx.preferences!.size!) ? availableUnits(product, ctx.preferences!.size) > 0 ? "Available" : "Out of stock" : "Not offered") });
  if (ctx.preferences?.maxPrice != null) {
    const currency = ctx.preferences.priceCurrency ?? ctx.display?.currency ?? "INR";
    const rate = currency === "INR" ? 1 : ctx.display?.currency === "USD" ? ctx.display.rate : null;
    rows.push({ label: "Your maximum budget", values: products.map(product => rate === null ? "Exchange rate unavailable" : product.price * rate <= ctx.preferences!.maxPrice! ? "Within budget" : "Above budget") });
  }
  const sorted = [...products].sort((a, b) => a.price - b.price);
  const cheapest = sorted[0], highest = sorted.at(-1)!;
  const difference = highest.price - cheapest.price;
  const summary = difference === 0 ? "These products have the same listed price."
    : Math.round(difference * (ctx.display?.rate ?? 1)) === 0 ? `The catalog prices differ by less than ${assistantPrice(1 / (ctx.display?.rate ?? 1), ctx.display)} at the displayed precision.`
    : products.length === 2 ? `${cheapest.name} costs ${assistantPrice(difference, ctx.display)} less than ${highest.name}.`
    : `${cheapest.name} has the lowest listed price at ${assistantPrice(cheapest.price, ctx.display)}; the price range is ${assistantPrice(difference, ctx.display)}.`;
  const differing = (["material", "fit", "care"] as const).find(topic => {
    const facts = products.map(product => productFact(product, topic));
    return facts.every(fact => fact.source === "catalog") && new Set(facts.map(fact => fact.text)).size > 1;
  });
  const distinction = differing ? `\n${differing[0].toUpperCase() + differing.slice(1)} differs: ` + products.map((product, index) => `${["first", "second", "third"][index]} — ${productFact(product, differing).text.slice(0, 140)}`).join("; ") + "." : "";
  const sizeMatch = ctx.preferences?.size ? `\nYour size ${ctx.preferences.size}: ` + products.map((product, index) => `${["first", "second", "third"][index]} — ${availableUnits(product, ctx.preferences!.size) > 0 ? "available" : "not available"}`).join("; ") + "." : "";
  const missing = rows.some(row => row.values.some(value => value === "Not listed")) ? "\nMissing attributes are marked Not listed." : "";
  const clarify = /\b(best|better|quality|comfortable|durable)\b/i.test(ctx.lastUserMessage) ? "\nWhat matters most to you—budget, fit or material?" : "";
  return { comparison: { products: products.map(product => ({ id: String(product.id), name: product.name })), rows },
    summary: summary + distinction + sizeMatch + missing + clarify };
}
