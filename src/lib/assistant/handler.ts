import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { getClientAddress, isRateLimited } from "../rateLimit";
import { runAssistant, type ResponsesClient } from "./chat";
import { supabaseCatalogStore } from "./catalogStore";
import { MAX_CART_LINES, MAX_MESSAGES, MAX_MESSAGE_LENGTH, type CartLineInput, type CatalogStore, type ChatMessage } from "./types";

const MAX_BODY_BYTES = 24_000;
const DEFAULT_MODEL = "gpt-4o-mini";

export interface AssistantDeps {
  store: CatalogStore;
  createClient: () => ResponsesClient | null;
  /** Returns true when the bearer token belongs to a real signed-in customer. */
  verifyToken: (token: string) => Promise<boolean>;
  rateLimit: (key: string) => Promise<boolean | null>;
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
    messages.push({ role, content: trimmed });
  }
  return messages.at(-1)?.role === "user" ? messages : null;
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
  const limited = await deps.rateLimit(`assistant:${getClientAddress(request)}`);
  if (limited === null) return json({ error: "The assistant is temporarily unavailable." }, 503);
  if (limited) return json({ error: "You're sending messages too quickly. Please wait a moment." }, 429);

  const client = deps.createClient();
  if (!client) return json({ error: "The shopping assistant is not configured." }, 503);

  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return json({ error: "Message is too long." }, 413);
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("shape");
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  const messages = parseMessages(body.messages);
  if (!messages) return json({ error: "Invalid or empty message." }, 400);

  // Identity comes only from a verified token; the model and the client body cannot assert it.
  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const authenticated = token ? await deps.verifyToken(token).catch(() => false) : false;

  try {
    const result = await runAssistant(client, deps.model(), messages, {
      store: deps.store, authenticated,
      cart: authenticated ? parseCart(body.cart) : [],
      lastUserMessage: messages.at(-1)!.content,
    });
    return json(result);
  } catch (error) {
    console.error("[assistant] request failed", {
      name: error instanceof Error ? error.name : "unknown",
      status: (error as { status?: number })?.status,
    });
    return json({ error: "The assistant couldn't answer right now. Please try again." }, 502);
  }
}

async function verifySupabaseToken(token: string): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return false;
  const { data, error } = await createClient(url, anonKey, { auth: { persistSession: false } }).auth.getUser(token);
  return !error && Boolean(data.user);
}

export const defaultDeps: AssistantDeps = {
  store: supabaseCatalogStore,
  createClient: () => {
    const apiKey = process.env.OPENAI_API_KEY;
    return apiKey ? (new OpenAI({ apiKey, timeout: 25_000, maxRetries: 1 }) as unknown as ResponsesClient) : null;
  },
  verifyToken: verifySupabaseToken,
  rateLimit: (key) => isRateLimited(key, 10, 60_000),
  model: () => process.env.OPENAI_MODEL || DEFAULT_MODEL,
};
