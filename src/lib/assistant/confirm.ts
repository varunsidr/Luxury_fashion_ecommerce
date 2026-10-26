import { NextResponse } from "next/server";
import { getClientAddress } from "../rateLimit";
import { availableUnits, cartAction, validVariant } from "./inventory";
import { parseCart, type AssistantDeps } from "./handler";
import { CONFIRM_DEADLINE_MS, withAbort, withRequestDeadline } from "./requestLifetime";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Read-only validation: this endpoint neither invokes a model nor changes/reserves inventory. */
export async function handleAssistantConfirmation(request: Request, deps: Pick<AssistantDeps, "store" | "verifyToken" | "rateLimit">): Promise<Response> {
  try { return await withRequestDeadline(request.signal, CONFIRM_DEADLINE_MS, signal => confirm(request, deps, signal)); }
  catch (error) { return error instanceof Error && error.name === "AbortError"
    ? json({ error: "Stock validation took too long or was cancelled. Please try again." }, 504)
    : json({ error: "Bag validation is temporarily unavailable. Please try again." }, 503); }
}

async function confirm(request: Request, deps: Pick<AssistantDeps, "store" | "verifyToken" | "rateLimit">, signal: AbortSignal): Promise<Response> {
  const limited = await withAbort(() => deps.rateLimit(`assistant-confirm:${getClientAddress(request)}`, signal), signal);
  if (limited === null) return json({ error: "Bag validation is temporarily unavailable." }, 503);
  if (limited) return json({ error: "Please wait a moment before trying again." }, 429);
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token || !await withAbort(() => deps.verifyToken(token, signal), signal).catch(() => false)) return json({ error: "Please sign in before adding to your bag." }, 401);
  let body: Record<string, unknown>;
  try {
    const raw = await withAbort(() => request.text(), signal);
    if (raw.length > 24000) return json({ error: "Request is too large." }, 413);
    body = JSON.parse(raw);
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error();
  } catch { return json({ error: "Invalid bag request." }, 400); }
  const { productId, size, color, quantity, price } = body;
  if (typeof productId !== "string" || !productId || productId.length > 100 ||
    !(size === null || typeof size === "string" && size.length > 0 && size.length <= 30) ||
    !(color === null || typeof color === "string" && color.length > 0 && color.length <= 40) ||
    !Number.isInteger(quantity) || (quantity as number) < 1 || (quantity as number) > 10 ||
    typeof price !== "number" || !Number.isFinite(price) || price < 0 ||
    !Array.isArray(body.cart) || body.cart.length > 30 || parseCart(body.cart).length !== body.cart.length) {
    return json({ error: "Invalid bag request." }, 400);
  }
  try {
    const product = (await withAbort(() => deps.store.listProducts({ fresh: true, signal }), signal)).find(product => String(product.id) === productId);
    if (!product) return json({ error: "This product is no longer listed. Ask for another recommendation." }, 404);
    if (!validVariant(product, size as string | null, color as string | null)) return json({ error: "These options have changed. Ask for a new recommendation." }, 409);
    if (!Number.isFinite(product.price) || product.price < 0) return json({ error: "Product pricing is unavailable." }, 503);
    if (product.price !== price) return json({ error: "The price has changed. Ask for a new recommendation before confirming." }, 409);
    const inBag = parseCart(body.cart).filter(line => line.id === productId && line.size === size).reduce((sum, line) => sum + line.quantity, 0);
    if (availableUnits(product, size as string | null) < (quantity as number) + inBag) return json({ error: "There is not enough stock for this addition and the items already in your bag." }, 409);
    return json({ action: cartAction(product, size as string | null, color as string | null, quantity as number) });
  } catch { return json({ error: "Could not verify current stock. Please try again." }, 503); }
}
