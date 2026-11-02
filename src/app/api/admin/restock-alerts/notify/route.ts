import { NextResponse } from "next/server";
import { verifyToken } from "@/lib/adminAuth";
import { processRestockAlerts } from "@/lib/processRestockAlerts";

export const maxDuration = 120;

export async function POST(request: Request) {
  const token = request.headers.get("cookie")?.split(";").map((part) => part.trim()).find((part) => part.startsWith("admin_token="))?.slice("admin_token=".length);
  if (!verifyToken(token ?? "")) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const productId = body.productId ?? null;
  if (productId !== null && (typeof productId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productId))) return NextResponse.json({ error: "Invalid product." }, { status: 400 });
  // Caller-supplied size/stock never determines who gets an email.
  return processRestockAlerts(productId);
}
