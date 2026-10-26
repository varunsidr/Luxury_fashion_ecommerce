import type { AssistantDisplay } from "./types";

export const DEFAULT_DISPLAY: AssistantDisplay = { currency: "INR", rate: 1 };

// Presentation only: prices sent to confirmation and checkout always remain INR.
export function parseDisplay(value: unknown): AssistantDisplay | null {
  if (value === undefined) return DEFAULT_DISPLAY;
  if (!value || typeof value !== "object") return null;
  const { currency, rate } = value as Record<string, unknown>;
  if (currency === "INR" && rate === 1) return DEFAULT_DISPLAY;
  if (currency === "USD" && typeof rate === "number" && Number.isFinite(rate) && rate > 0 && rate <= 1000) return { currency, rate };
  return null;
}

export function assistantPrice(priceInr: number, display = DEFAULT_DISPLAY): string {
  return new Intl.NumberFormat(display.currency === "INR" ? "en-IN" : "en-US", {
    style: "currency", currency: display.currency, minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(Math.round(priceInr * display.rate));
}
