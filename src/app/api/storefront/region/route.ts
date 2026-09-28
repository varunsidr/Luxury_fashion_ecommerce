import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const detectedCountry = (
    request.headers.get("x-vercel-ip-country") ??
    request.headers.get("cf-ipcountry") ??
    ""
  ).toUpperCase();
  const fallback = new URL(request.url).searchParams.get("fallback");
  const country = detectedCountry || (fallback === "USD" ? "US" : "IN");

  if (country !== "US") {
    return NextResponse.json(
      { country, currency: "INR", rate: 1, rateDate: null },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }

  try {
    const response = await fetch("https://api.frankfurter.dev/v2/rate/inr/usd", {
      next: { revalidate: 43_200 },
    });
    if (!response.ok) throw new Error("Exchange rate request failed");
    const result: { rate?: number; date?: string } = await response.json();
    if (!Number.isFinite(result.rate) || !result.rate || result.rate <= 0) {
      throw new Error("Exchange rate was invalid");
    }

    return NextResponse.json(
      { country, currency: "USD", rate: result.rate, rateDate: result.date ?? null },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch {
    // Keep customers on the store currency if the rate provider is unavailable.
    return NextResponse.json(
      { country, currency: "INR", rate: 1, rateDate: null },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
