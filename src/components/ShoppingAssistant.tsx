"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2, MessageCircle, RotateCcw, Send, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useCart } from "@/context/CartContext";
import { useCurrency } from "@/context/CurrencyContext";
import type { AddToCartAction, AssistantReply, ChatMessage, ProductCardData } from "@/lib/assistant/types";
import { MAX_MESSAGE_LENGTH } from "@/lib/assistant/types";

interface UiMessage extends ChatMessage {
  id: number;
  products?: ProductCardData[];
  actions?: AddToCartAction[];
}

const GREETING = "Hi, I'm your zeouf shopping assistant. Ask me about products, prices, availability, categories or our shipping and returns information.";
const SUGGESTIONS = ["Show me products under ₹2000", "Recommend a gift", "What is your returns policy?"];

export default function ShoppingAssistant() {
  const { items, addItem } = useCart();
  const { formatPrice } = useCurrency();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const nextId = useRef(1);
  const busy = useRef(false);
  const failedHistory = useRef<ChatMessage[] | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "end" });
  }, [messages, loading, error, open]);

  const close = useCallback(() => {
    setOpen(false);
    launcherRef.current?.focus();
  }, []);

  const request = useCallback(async (history: ChatMessage[]) => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setError(null);
    failedHistory.current = null;
    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
        body: JSON.stringify({
          messages: history,
          cart: token ? items.map((item) => ({ id: item.id, size: item.size, color: item.color ?? null, quantity: item.quantity })) : [],
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body) throw new Error(typeof body?.error === "string" ? body.error : "Something went wrong.");
      const reply = body as AssistantReply;
      setMessages((prev) => [...prev, { id: nextId.current++, role: "assistant", content: reply.reply, products: reply.products, actions: reply.actions }]);
    } catch (caught) {
      failedHistory.current = history;
      setError(caught instanceof Error && caught.message ? caught.message : "Something went wrong.");
    } finally {
      busy.current = false;
      setLoading(false);
    }
  }, [items]);

  const send = useCallback((text: string) => {
    const content = text.trim();
    if (!content || busy.current) return;
    const userMessage: UiMessage = { id: nextId.current++, role: "user", content: content.slice(0, MAX_MESSAGE_LENGTH) };
    setMessages((prev) => [...prev, userMessage]);
    setDraft("");
    void request([...messages, userMessage].map(({ role, content: body }) => ({ role, content: body })));
  }, [messages, request]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    send(draft);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      send(draft);
    }
  };

  const confirmAdd = (messageId: number, action: AddToCartAction) => {
    addItem({ id: action.productId, name: action.name, price: action.price, image_url: action.image_url, category: action.category, size: action.size, color: action.color }, action.quantity);
    setConfirmed((prev) => new Set(prev).add(`${messageId}:${action.productId}`));
  };

  return (
    <>
      <button
        ref={launcherRef}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-label={open ? "Close shopping assistant" : "Open shopping assistant"}
        aria-expanded={open}
        aria-controls="shopping-assistant-panel"
        data-testid="assistant-launcher"
        className="fixed bottom-4 right-4 z-[45] flex h-14 w-14 items-center justify-center rounded-full bg-neutral-900 text-white shadow-lg transition-transform duration-200 hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900 pb-[env(safe-area-inset-bottom)] sm:bottom-6 sm:right-6"
      >
        {open ? <X size={22} aria-hidden="true" /> : <MessageCircle size={22} aria-hidden="true" />}
      </button>

      {open && (
        <section
          id="shopping-assistant-panel"
          role="dialog"
          aria-modal="false"
          aria-label="Shopping assistant"
          data-testid="assistant-panel"
          onKeyDown={(event) => { if (event.key === "Escape") close(); }}
          className="fixed inset-x-0 bottom-0 z-[55] flex h-[min(85dvh,640px)] flex-col border border-neutral-200 bg-[#fdfcf9] shadow-2xl sm:inset-x-auto sm:bottom-24 sm:right-6 sm:h-[min(640px,calc(100dvh-8rem))] sm:w-[400px]"
        >
          <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
            <div>
              <h2 className="font-playfair text-lg text-neutral-900">Shopping assistant</h2>
              <p className="text-[11px] text-neutral-500">AI-generated answers can be wrong. Check product pages.</p>
            </div>
            <button type="button" onClick={close} aria-label="Close shopping assistant" className="flex h-11 w-11 items-center justify-center text-neutral-600 hover:text-neutral-900">
              <X size={20} aria-hidden="true" />
            </button>
          </header>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4" role="log" aria-live="polite" aria-relevant="additions" data-testid="assistant-log">
            <p className="max-w-[85%] bg-white px-3 py-2 text-sm text-neutral-800 shadow-sm">{GREETING}</p>
            {messages.length === 0 && (
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button key={suggestion} type="button" onClick={() => send(suggestion)} className="min-h-11 border border-neutral-300 px-3 text-xs text-neutral-700 hover:border-neutral-900">
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
            {messages.map((message) => (
              <div key={message.id} className={message.role === "user" ? "flex justify-end" : "flex flex-col items-start gap-2"} data-testid={`assistant-message-${message.role}`}>
                <p className={`max-w-[85%] whitespace-pre-wrap break-words px-3 py-2 text-sm ${message.role === "user" ? "bg-neutral-900 text-white" : "bg-white text-neutral-800 shadow-sm"}`}>
                  {message.content}
                </p>
                {message.products?.map((product) => (
                  <Link key={product.id} href={product.url} onClick={() => setOpen(false)} data-testid="assistant-product-card"
                    className="flex w-full max-w-[85%] items-center gap-3 border border-neutral-200 bg-white p-2 hover:border-neutral-900">
                    <Image src={product.image_url} alt="" width={48} height={64} unoptimized className="h-16 w-12 shrink-0 object-cover" />
                    <span className="min-w-0 text-sm">
                      <span className="block truncate text-neutral-900">{product.name}</span>
                      <span className="block text-neutral-600">{formatPrice(product.price)}</span>
                      {!product.inStock && <span className="block text-xs text-red-700">Out of stock</span>}
                    </span>
                  </Link>
                ))}
                {message.actions?.map((action) => {
                  const done = confirmed.has(`${message.id}:${action.productId}`);
                  return (
                    <div key={action.productId} data-testid="assistant-add-confirmation" className="w-full max-w-[85%] border border-neutral-900 bg-white p-3 text-sm">
                      <p className="text-neutral-900">Add to bag?</p>
                      <p className="text-neutral-600">
                        {action.quantity} × {action.name}{action.size ? `, size ${action.size}` : ""}{action.color ? `, ${action.color}` : ""} — {formatPrice(action.price * action.quantity)}
                      </p>
                      {done ? <p className="mt-2 text-xs text-neutral-500">Sent to your bag.</p> : (
                        <button type="button" onClick={() => confirmAdd(message.id, action)} className="mt-2 min-h-11 bg-neutral-900 px-4 text-xs uppercase tracking-widest text-white">
                          Confirm
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
            {loading && (
              <p className="flex items-center gap-2 text-sm text-neutral-500" role="status" data-testid="assistant-typing">
                <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Thinking…
              </p>
            )}
            {error && !loading && (
              <div role="alert" className="border border-red-200 bg-red-50 p-3 text-sm text-red-800" data-testid="assistant-error">
                <p>{error}</p>
                {failedHistory.current && (
                  <button type="button" onClick={() => failedHistory.current && void request(failedHistory.current)} className="mt-2 inline-flex min-h-11 items-center gap-2 underline">
                    <RotateCcw size={14} aria-hidden="true" /> Retry
                  </button>
                )}
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form onSubmit={onSubmit} className="flex items-end gap-2 border-t border-neutral-200 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <label htmlFor="assistant-input" className="sr-only">Message the shopping assistant</label>
            <textarea
              id="assistant-input" ref={inputRef} rows={1} value={draft} maxLength={MAX_MESSAGE_LENGTH}
              onChange={(event) => setDraft(event.target.value)} onKeyDown={onKeyDown}
              placeholder="Ask about products…"
              className="max-h-28 min-h-11 flex-1 resize-none border border-neutral-300 bg-white px-3 py-2 text-base text-neutral-900 focus:border-neutral-900 focus:outline-none"
            />
            <button type="submit" disabled={loading || !draft.trim()} aria-label="Send message"
              className="flex h-11 w-11 items-center justify-center bg-neutral-900 text-white disabled:opacity-40">
              <Send size={18} aria-hidden="true" />
            </button>
          </form>
        </section>
      )}
    </>
  );
}
