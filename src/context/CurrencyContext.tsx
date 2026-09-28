"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type StoreCurrency = "INR" | "USD";

interface CurrencyContextValue {
  currency: StoreCurrency;
  rate: number;
  convertPrice: (priceInr: number) => number;
  formatPrice: (priceInr: number) => string;
}

const CurrencyContext = createContext<CurrencyContextValue>({
  currency: "INR",
  rate: 1,
  convertPrice: (price) => Math.round(price),
  formatPrice: (price) => new Intl.NumberFormat("en-IN", {
    style: "currency", currency: "INR", maximumFractionDigits: 0,
  }).format(Math.round(price)),
});

function browserCurrency(): StoreCurrency {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "";
  if (timeZone === "Asia/Kolkata" || timeZone === "Asia/Calcutta") return "INR";
  if (timeZone.startsWith("America/")) return "USD";
  return navigator.languages.some((language) => language.toUpperCase().endsWith("-US"))
    ? "USD"
    : "INR";
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrency] = useState<StoreCurrency>("INR");
  const [rate, setRate] = useState(1);

  useEffect(() => {
    let active = true;
    fetch(`/api/storefront/region?fallback=${browserCurrency()}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not detect store region");
        return response.json();
      })
      .then((result: { currency?: StoreCurrency; rate?: number }) => {
        if (!active) return;
        if (result.currency === "USD" && Number.isFinite(result.rate) && Number(result.rate) > 0) {
          setCurrency("USD");
          setRate(Number(result.rate));
        } else {
          setCurrency("INR");
          setRate(1);
        }
      })
      .catch(() => {
        if (active) {
          // Keep the store currency if the location or rate service is offline.
          setCurrency("INR");
          setRate(1);
        }
      });
    return () => { active = false; };
  }, []);

  const value = useMemo<CurrencyContextValue>(() => ({
    currency,
    rate,
    convertPrice: (priceInr) => Math.round(Number(priceInr || 0) * rate),
    formatPrice: (priceInr) => new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Math.round(Number(priceInr || 0) * rate)),
  }), [currency, rate]);

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
