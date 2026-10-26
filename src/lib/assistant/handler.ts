import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { getClientAddress, isRateLimited } from "../rateLimit";
import { runAssistant, runInteraction, type ResponsesClient } from "./chat";
import { supabaseCatalogStore } from "./catalogStore";
import { MAX_CART_LINES, MAX_MESSAGES, MAX_MESSAGE_LENGTH, type AssistantInteraction, type CartLineInput, type CatalogStore, type ChatMessage } from "./types";
import { parseDisplay } from "./presentation";
import { CHAT_DEADLINE_MS, withAbort, withRequestDeadline } from "./requestLifetime";

const MAX_BODY_BYTES = 24_000;
const DEFAULT_MODEL = "openai/gpt-oss-20b";

export interface AssistantDeps {
  store: CatalogStore;
  createClient: () => ResponsesClient | null;
  /** Returns true when the bearer token belongs to a real signed-in customer. */
  verifyToken: (token: string, signal?: AbortSignal) => Promise<boolean>;
  rateLimit: (key: string, signal?: AbortSignal) => Promise<boolean | null>;
  model: () => string;
}

const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export function parseMessages(value: unknown): ChatMessage[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 50) return null;
  const messages: ChatMessage[] = [];
  for (const entry of value.slice(-MAX_MESSAGES)) {
    if (!entry || typeof entry !== "object") return null;
    const { role, content } = entry as Record<string, unknown>;
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") return null;
    const trimmed = content.trim();
    if (!trimmed || trimmed.length > MAX_MESSAGE_LENGTH) return null;
    const productIds = (entry as Record<string, unknown>).productIds;
    if (productIds !== undefined && (role !== "assistant" || !validIds(productIds, 0, 3))) return null;
    messages.push({ role, content: trimmed, ...(productIds === undefined ? {} : { productIds: productIds as string[] }) });
  }
  return messages.at(-1)?.role === "user" ? messages : null;
}

function validIds(value: unknown, min: number, max: number): value is string[] {
  return Array.isArray(value) && value.length >= min && value.length <= max && new Set(value).size === value.length &&
    value.every(id => typeof id === "string" && id.trim() === id && id.length > 0 && id.length <= 100);
}

export function parseInteraction(value: unknown): AssistantInteraction | null {
  if (!value || typeof value !== "object") return null;
  const { type, productId, productIds, size, color, quantity } = value as Record<string, unknown>;
  if (type === "compare") return validIds(productIds, 2, 3) ? { type, productIds } : null;
  if (!validIds([productId], 1, 1)) return null;
  if (type === "similar") return { type, productId: productId as string };
  if (type !== "prepare_add" || !Number.isInteger(quantity) || (quantity as number) < 1 || (quantity as number) > 10 ||
    !(size === null || typeof size === "string" && size.length > 0 && size.length <= 30) ||
    !(color === null || typeof color === "string" && color.length > 0 && color.length <= 40)) return null;
  return { type, productId: productId as string, size: size as string | null, color: color as string | null, quantity: quantity as number };
}

export function parseCart(value: unknown): CartLineInput[] {
  if (!Array.isArray(value)) return [];
  const lines: CartLineInput[] = [];
  for (const entry of value.slice(0, MAX_CART_LINES)) {
    if (!entry || typeof entry !== "object") continue;
    const { id, size, color, quantity } = entry as Record<string, unknown>;
    if (typeof id !== "string" || !id || id.length > 100 || !Number.isInteger(quantity) || (quantity as number) < 1 || (quantity as number) > 1000) continue;
    lines.push({
      id, quantity: quantity as number,
      size: typeof size === "string" && size ? size.slice(0, 30) : null,
      color: typeof color === "string" && color ? color.slice(0, 40) : null,
    });
  }
  return lines;
}

export async function handleAssistantRequest(request: Request, deps: AssistantDeps): Promise<Response> {
  try {
    return await withRequestDeadline(request.signal, CHAT_DEADLINE_MS, signal => handleRequest(request, deps, signal));
  } catch (error) {
    return error instanceof Error && error.name === "AbortError"
      ? json({ error: "The assistant took too long or the request was cancelled. Please try again." }, 504)
      : json({ error: "The assistant is temporarily unavailable. Please try again." }, 503);
  }
}

async function handleRequest(request: Request, deps: AssistantDeps, signal: AbortSignal): Promise<Response> {
  const limited = await withAbort(() => deps.rateLimit(`assistant:${getClientAddress(request)}`, signal), signal);
  if (limited === null) return json({ error: "The assistant is temporarily unavailable." }, 503);
  if (limited) return json({ error: "You're sending messages too quickly. Please wait a moment." }, 429);

  let body: Record<string, unknown>;
  try {
    const raw = await withAbort(() => request.text(), signal);
    if (raw.length > MAX_BODY_BYTES) return json({ error: "Message is too long." }, 413);
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("shape");
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  const messages = parseMessages(body.messages);
  if (!messages) return json({ error: "Invalid or empty message." }, 400);
  const display = parseDisplay(body.display);
  const interaction = parseInteraction(body.interaction);
  if (!display || body.interaction !== undefined && !interaction) return json({ error: "Invalid display or shopping action." }, 400);
  const client = interaction ? null : deps.createClient();
  if (!interaction && !client) return json({ error: "The shopping assistant is not configured." }, 503);

  // Identity comes only from a verified token; the model and the client body cannot assert it.
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const authenticated = token ? await withAbort(() => deps.verifyToken(token, signal), signal).catch(() => false) : false;

  try {
    const ctx = {
      store: { listProducts: (options?: { fresh?: boolean; signal?: AbortSignal }) => withAbort(() => deps.store.listProducts({ ...options, signal }), signal) }, authenticated,
      cart: authenticated ? parseCart(body.cart) : [],
      lastUserMessage: messages.at(-1)!.content,
      display, signal,
    };
    const result = interaction ? await runInteraction(interaction, ctx) : await runAssistant(client!, deps.model(), messages, ctx);
    return json(result);
  } catch (error) {
    if (signal.aborted) return json({ error: "The assistant took too long. Please try again." }, 504);
    console.error("[assistant] request failed", {
      name: error instanceof Error ? error.name : "unknown",
      status: (error as { status?: number })?.status,
    });
    if ((error as { status?: number })?.status === 429) {
      return json({ error: "The assistant has reached its usage limit. Please try again later or browse the store directly." }, 429);
    }
    return json({ error: "The assistant couldn't answer right now. Please try again." }, 502);
  }
}

async function verifySupabaseToken(token: string, signal?: AbortSignal): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return false;
  const { data, error } = await createClient(url, anonKey, {
    auth: { persistSession: false },
    ...(signal ? { global: { fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, signal }) } } : {}),
  }).auth.getUser(token);
  return !error && Boolean(data.user);
}

export function createGroqClient(env: Record<string, string | undefined> = process.env): OpenAI | null {
  const apiKey = env.GROQ_API_KEY?.trim();
  return apiKey ? new OpenAI({
    apiKey,
    baseURL: "https://api.groq.com/openai/v1",
    timeout: 25_000,
    // Let the shopper retry; automatic retries also consume the free allowance.
    maxRetries: 0,
  }) : null;
}

export const defaultDeps: AssistantDeps = {
  store: supabaseCatalogStore,
  createClient: () => createGroqClient() as unknown as ResponsesClient | null,
  verifyToken: verifySupabaseToken,
  rateLimit: (key, signal) => isRateLimited(key, 10, 60_000, signal),
  model: () => process.env.GROQ_MODEL?.trim() || DEFAULT_MODEL,
};
