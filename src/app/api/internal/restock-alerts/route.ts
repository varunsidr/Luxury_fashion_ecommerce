import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { processRestockAlerts } from "@/lib/processRestockAlerts";

export const maxDuration = 120;

// Call every minute from an external scheduler with the bearer secret.
export async function POST(request: Request) {
  const secret = process.env.RESTOCK_CRON_SECRET;
  const expected = `Bearer ${secret}`;
  const supplied = request.headers.get("authorization") ?? "";
  if (!secret || secret.length < 32 || Buffer.byteLength(supplied) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  return processRestockAlerts();
}
