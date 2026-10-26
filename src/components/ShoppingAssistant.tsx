"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { ArrowDown, ArrowRight, ArrowUp, Check, Gift, Loader2, MessageCircle, RotateCcw, ShieldCheck, ShoppingBag, SlidersHorizontal, Sparkles, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useCart } from "@/context/CartContext";
import { useCurrency } from "@/context/CurrencyContext";
import type { AddToCartAction, AssistantInteraction, AssistantReply, ChatMessage, ProductCardData } from "@/lib/assistant/types";
import { MAX_MESSAGE_LENGTH, MAX_MESSAGES, MAX_CART_LINES } from "@/lib/assistant/types";
import { withAbort } from "@/lib/assistant/requestLifetime";
import AssistantProductCard from "./AssistantProductCard";
import "./shopping-assistant.css";

interface UiMessage extends ChatMessage {
  id: number;
  products?: ProductCardData[];
  actions?: AddToCartAction[];
}

const GREETING = "Find new favourites, check sizes, compare the details, and build your bag. What catches your eye?";

function historyOf(messages: UiMessage[]): ChatMessage[] {
  return messages.map(({ role, content, products, productIds }) => ({ role, content,
    ...(role === "assistant" ? { productIds: products?.map(product => product.id) ?? productIds ?? [] } : {}),
  }));
}

export default function ShoppingAssistant() {
  const { items, addItem, setCartOpen } = useCart();
  const { formatPrice, currency, rate } = useCurrency();
  const suggestions = [`Show me products under ${currency === "USD" ? "$25" : "₹2000"}`, "Recommend a gift", "What is your returns policy?"];
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [showLatest, setShowLatest] = useState(false);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const confirmedRef = useRef(new Set<string>());
  const confirmBusy = useRef(false);
  const identity = useRef<string | null | undefined>(undefined);
  const generation = useRef(0);
  const controllers = useRef(new Set<AbortController>());
  const currentCart = useRef(items);
  const nextId = useRef(1);
  const busy = useRef(false);
  const failedHistory = useRef<{ history: ChatMessage[]; interaction?: AssistantInteraction } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const pinned = useRef(true);
  const autoScrolling = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { currentCart.current = items; }, [items]);

  const resetConversation = useCallback(() => {
    generation.current++;
    controllers.current.forEach(controller => controller.abort());
    controllers.current.clear();
    busy.current = false;
    confirmBusy.current = false;
    failedHistory.current = null;
    confirmedRef.current = new Set();
    setMessages([]); setDraft(""); setError(null); setLoading(false);
    setConfirmed(new Set()); setConfirming(null);
    setCompareIds([]);
    pinned.current = true;
    autoScrolling.current = false;
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    logRef.current?.scrollTo({ top: 0, behavior: "instant" });
    setShowLatest(false);
  }, []);

  useEffect(() => {
    let active = true, observed = false;
    const pendingControllers = controllers.current;
    const invalidate = () => { generation.current++; };
    const observe = (id: string | null) => {
      if (!active) return;
      if (identity.current !== undefined && identity.current !== id) resetConversation();
      identity.current = id;
    };
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      observed = true;
      observe(session?.user?.id ?? null);
    });
    void supabase.auth.getSession().then(({ data }) => {
      if (!observed) observe(data.session?.user?.id ?? null);
    }).catch(() => { if (!observed) observe(null); });
    return () => {
      active = false; invalidate();
      data.subscription.unsubscribe();
      pendingControllers.forEach(controller => controller.abort());
      pendingControllers.clear();
      busy.current = false; confirmBusy.current = false;
    };
  }, [resetConversation]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const scrollToLatest = useCallback(() => {
    const log = logRef.current;
    if (!log) return;
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    pinned.current = true;
    autoScrolling.current = true;
    log.scrollTo({ top: log.scrollHeight, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    scrollTimer.current = setTimeout(() => { autoScrolling.current = false; }, 600);
  }, []);

  useEffect(() => {
    if (open && pinned.current && (messages.length > 0 || loading || error)) scrollToLatest();
  }, [messages, loading, error, open, scrollToLatest]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input || !open) return;
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 128) + "px";
  }, [draft, open]);

  useEffect(() => {
    if (!open) return;
    const viewport = window.visualViewport;
    const fitViewport = () => {
      panelRef.current?.style.setProperty("--assistant-vh", (viewport?.height ?? window.innerHeight) + "px");
      panelRef.current?.style.setProperty("--assistant-keyboard", Math.max(0, window.innerHeight - (viewport ? viewport.height + viewport.offsetTop : window.innerHeight)) + "px");
    };
    fitViewport();
    viewport?.addEventListener("resize", fitViewport);
    viewport?.addEventListener("scroll", fitViewport);
    window.addEventListener("resize", fitViewport);
    return () => { viewport?.removeEventListener("resize", fitViewport); viewport?.removeEventListener("scroll", fitViewport); window.removeEventListener("resize", fitViewport); };
  }, [open]);

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
  }, []);

  const openPanel = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setClosing(false);
    pinned.current = true;
    setShowLatest(false);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setClosing(!reduced);
    if (!reduced) closeTimer.current = setTimeout(() => setClosing(false), 180);
    launcherRef.current?.focus();
  }, []);

  const stopAutoScroll = () => {
    autoScrolling.current = false;
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
  };

  const onLogScroll = () => {
    const log = logRef.current;
    if (!log) return;
    if (autoScrolling.current) { setShowLatest(false); return; }
    pinned.current = log.scrollHeight - log.scrollTop - log.clientHeight < 80;
    setShowLatest(!pinned.current && messages.length > 0);
  };

  const request = useCallback(async (history: ChatMessage[], interaction?: AssistantInteraction) => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setError(null);
    failedHistory.current = null;
    const scope = generation.current;
    const controller = new AbortController();
    controllers.current.add(controller);
    const timer = setTimeout(() => controller.abort(), 45000);
    try {
      const { data } = await withAbort(() => supabase.auth.getSession(), controller.signal);
      if (generation.current !== scope) return;
      const userId = data?.session?.user?.id ?? null;
      if (identity.current !== undefined && identity.current !== userId) {
        identity.current = userId; resetConversation(); return;
      }
      identity.current = userId;
      const token = data?.session?.access_token;
      const response = await fetch("/api/assistant", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
        body: JSON.stringify({
          messages: history.slice(-MAX_MESSAGES).map(({ role, content, productIds }) => ({ role, content: content.slice(0, MAX_MESSAGE_LENGTH), ...(productIds ? { productIds } : {}) })),
          display: { currency, rate }, interaction,
          cart: token ? currentCart.current.slice(0, MAX_CART_LINES).map((item) => ({ id: item.id, size: item.size, color: item.color ?? null, quantity: item.quantity })) : [],
        }),
      });
      const body = await response.json().catch(() => null);
      if (generation.current !== scope || identity.current !== userId) return;
      if (!response.ok || !body) throw new Error(typeof body?.error === "string" ? body.error : "Something went wrong.");
      const reply = body as AssistantReply;
      setMessages((prev) => [...prev, { id: nextId.current++, role: "assistant", content: reply.reply, products: reply.products, actions: reply.actions }]);
    } catch (caught) {
      if (generation.current !== scope) return;
      failedHistory.current = { history, interaction };
      setError(controller.signal.aborted ? "The assistant took too long. Please try again." : caught instanceof Error && caught.message ? caught.message : "Something went wrong.");
    } finally {
      clearTimeout(timer); controllers.current.delete(controller);
      if (generation.current === scope) { busy.current = false; setLoading(false); }
    }
  }, [resetConversation, currency, rate]);

  const send = useCallback((text: string, interaction?: AssistantInteraction) => {
    const content = text.trim();
    if (!content || busy.current) return;
    pinned.current = true;
    setShowLatest(false);
    const userMessage: UiMessage = { id: nextId.current++, role: "user", content: content.slice(0, MAX_MESSAGE_LENGTH) };
    setMessages((prev) => [...prev, userMessage]);
    setDraft("");
    void request(historyOf([...messages, userMessage]), interaction);
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

  const confirmAdd = async (messageId: number, action: AddToCartAction) => {
    const key = `${messageId}:${action.productId}`;
    if (confirmBusy.current || confirmedRef.current.has(key)) return;
    confirmBusy.current = true; setConfirming(key); setError(null); failedHistory.current = null;
    const scope = generation.current, owner = identity.current;
    const controller = new AbortController();
    controllers.current.add(controller);
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const { data } = await withAbort(() => supabase.auth.getSession(), controller.signal);
      if (generation.current !== scope) return;
      const session = data?.session;
      if (!session?.user?.id || session.user.id !== owner) throw new Error("Your session changed. Sign in and ask for a new recommendation.");
      const cart = currentCart.current.map(item => ({ id: item.id, size: item.size, color: item.color ?? null, quantity: item.quantity }));
      const response = await fetch("/api/assistant/confirm", {
        method: "POST", signal: controller.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ productId: action.productId, size: action.size, color: action.color, quantity: action.quantity, price: action.price, cart }),
      });
      const body = await response.json().catch(() => null);
      if (generation.current !== scope || identity.current !== owner) return;
      if (!response.ok || !body?.action) throw new Error(body?.error || "Could not verify this addition. Please try again.");
      const latest = await withAbort(() => supabase.auth.getSession(), controller.signal);
      if (generation.current !== scope) return;
      if (latest.data.session?.user?.id !== owner) throw new Error("Your session changed. Ask for a new recommendation.");
      const now = currentCart.current.map(item => ({ id: item.id, size: item.size, color: item.color ?? null, quantity: item.quantity }));
      if (JSON.stringify(cart) !== JSON.stringify(now)) throw new Error("Your bag changed while checking stock. Please confirm again.");
      const fresh = body.action as AddToCartAction;
      if (!addItem({ id: fresh.productId, name: fresh.name, price: fresh.price, image_url: fresh.image_url, category: fresh.category, size: fresh.size, color: fresh.color }, fresh.quantity, session.user.id)) {
        throw new Error("The item was not added. Check your session and try again.");
      }
      confirmedRef.current.add(key);
      setConfirmed(new Set(confirmedRef.current));
    } catch (caught) {
      if (generation.current === scope) setError(controller.signal.aborted ? "Stock validation took too long. Please try again." : caught instanceof Error ? caught.message : "The item was not added.");
    } finally {
      clearTimeout(timer); controllers.current.delete(controller);
      if (generation.current === scope) { confirmBusy.current = false; setConfirming(null); }
    }
  };

  return (
    <div className="zeouf-assistant">
      <button ref={launcherRef} type="button" onClick={() => (open ? close() : openPanel())}
        aria-label={open ? "Close shopping assistant" : "Open shopping assistant"}
        aria-expanded={open} aria-controls="shopping-assistant-panel" data-testid="assistant-launcher"
        className="assistant-launcher" data-open={open}>
        <span className="assistant-launcher-icon" aria-hidden="true">{open ? <X size={20} /> : <Sparkles size={20} />}</span>
        <span className="assistant-launcher-label">Ask Zeouf</span>
        <span className="assistant-launcher-key" aria-hidden="true"><MessageCircle size={15} /></span>
      </button>

      {(open || closing) && (
        <section ref={panelRef} id="shopping-assistant-panel" role="dialog" aria-modal="false"
          aria-label="Zeouf Shopping Assistant" aria-hidden={!open} inert={!open}
          data-testid="assistant-panel" data-state={open ? "open" : "closed"} className="assistant-panel"
          onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); close(); } }}>
          <header className="assistant-header">
            <span className="assistant-avatar" aria-hidden="true">z.</span>
            <div className="assistant-header-copy">
              <h2>Zeouf Shopping Assistant</h2>
              <p>A little inspiration, on demand.</p>
            </div>
            <div className="assistant-header-actions">
              <button type="button" onClick={resetConversation} aria-label="New conversation" title="New conversation" className="assistant-icon-button"><RotateCcw size={17} aria-hidden="true" /></button>
              <button type="button" onClick={close} aria-label="Close shopping assistant" title="Close" className="assistant-icon-button"><X size={19} aria-hidden="true" /></button>
            </div>
          </header>

          <div className="assistant-transcript">
            <div ref={logRef} className="assistant-log" role="log" aria-label="Shopping conversation" aria-live="polite"
              aria-relevant="additions" tabIndex={0} data-testid="assistant-log" onScroll={onLogScroll}
              onWheel={stopAutoScroll} onTouchStart={stopAutoScroll} onPointerDown={stopAutoScroll}
              onKeyDown={event => { if (["PageUp", "Home", "ArrowUp"].includes(event.key)) stopAutoScroll(); }}>
              {messages.length === 0 ? (
                <div className="assistant-welcome assistant-reveal">
                  <div className="assistant-welcome-symbol" aria-hidden="true"><Sparkles size={27} strokeWidth={1.2} /></div>
                  <span className="assistant-eyebrow">The Zeouf edit</span>
                  <h3>Good finds.<br /><span>Great conversations.</span></h3>
                  <p className="assistant-intro">{GREETING}</p>
                  <div className="assistant-suggestions">
                    {suggestions.map((suggestion, index) => {
                      const Icon = [SlidersHorizontal, Gift, ShieldCheck][index];
                      return (
                        <button key={suggestion} type="button" onClick={() => send(suggestion)} className="assistant-suggestion">
                          <span className="assistant-suggestion-icon" aria-hidden="true"><Icon size={18} strokeWidth={1.5} /></span>
                          <span>{suggestion}</span>
                          <ArrowRight size={16} aria-hidden="true" className="assistant-suggestion-arrow" />
                        </button>
                      );
                    })}
                  </div>
                  <p className="assistant-welcome-note">A fresh perspective on your next favourite.</p>
                </div>
              ) : (
                <div className="assistant-conversation-start"><span />Your shopping edit<span /></div>
              )}

              {messages.map(message => (
                <div key={message.id} className={"assistant-message assistant-reveal assistant-message-" + message.role}
                  data-testid={"assistant-message-" + message.role}>
                  {message.role === "assistant" && <div className="assistant-message-author"><Sparkles size={12} aria-hidden="true" /> Zeouf</div>}
                  <p className="assistant-message-text">{message.content}</p>
                  {message.products?.map(product => (
                    <AssistantProductCard key={product.id} product={product} busy={loading || confirming !== null}
                      selected={compareIds.includes(product.id)} onNavigate={close}
                      onCompare={() => setCompareIds(previous => previous.includes(product.id) ? previous.filter(id => id !== product.id) : previous.length < 3 ? [...previous, product.id] : previous)}
                      onSimilar={() => send("Find products similar to " + product.name + ".", { type: "similar", productId: product.id })}
                      onAdd={(size, color, quantity) => send("Add " + quantity + " × " + product.name + (size ? ", size " + size : "") + (color ? ", color " + color : "") + " to my bag.", { type: "prepare_add", productId: product.id, size, color, quantity })} />
                  ))}
                  {message.actions?.map(action => {
                    const done = confirmed.has(message.id + ":" + action.productId);
                    const checking = confirming === message.id + ":" + action.productId;
                    return (
                      <div key={action.productId} data-testid="assistant-add-confirmation" className="assistant-confirmation" data-done={done}>
                        <div className="assistant-confirmation-heading">
                          <span className="assistant-confirmation-icon" aria-hidden="true">{done ? <Check size={18} /> : <ShoppingBag size={18} />}</span>
                          <span>{done ? "A good choice." : "Add to bag?"}</span>
                        </div>
                        <p>{action.quantity} × {action.name}{action.size ? ", size " + action.size : ""}{action.color ? ", " + action.color : ""} — {formatPrice(action.price * action.quantity)}</p>
                        {done ? (
                          <div><p className="assistant-success">Sent to your bag.</p><button type="button" className="assistant-primary" onClick={() => { close(); setCartOpen(true); }}>View bag <ArrowRight size={16} aria-hidden="true" /></button></div>
                        ) : (
                          <button type="button" disabled={confirming !== null} onClick={() => void confirmAdd(message.id, action)} className="assistant-primary">
                            {checking ? <><Loader2 size={16} className="assistant-spinner" aria-hidden="true" />Checking…</> : <>Confirm <ArrowRight size={16} aria-hidden="true" /></>}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
              {loading && (
                <div className="assistant-thinking assistant-reveal" role="status" aria-label="Zeouf is thinking" data-testid="assistant-typing">
                  <span className="assistant-thinking-dots" aria-hidden="true"><i /><i /><i /></span>
                  <span>Finding your edit</span>
                </div>
              )}
              {error && !loading && (
                <div role="alert" className="assistant-error assistant-reveal" data-testid="assistant-error">
                  <p>{error}</p>
                  {failedHistory.current && <button type="button" onClick={() => failedHistory.current && void request(failedHistory.current.history, failedHistory.current.interaction)} className="assistant-retry"><RotateCcw size={14} aria-hidden="true" /> Retry</button>}
                </div>
              )}
            </div>
            {showLatest && <button type="button" className="assistant-latest" onClick={() => { setShowLatest(false); scrollToLatest(); }}><ArrowDown size={14} aria-hidden="true" />Latest message</button>}
          </div>

          {compareIds.length > 0 && (
            <div className="assistant-compare-bar" role="status">
              <span className="assistant-compare-count">{compareIds.length}/3 selected</span>
              <button type="button" disabled={compareIds.length < 2 || loading || confirming !== null} className="assistant-compare-go"
                onClick={() => { send("Compare these selected products.", { type: "compare", productIds: compareIds }); setCompareIds([]); }}>Compare selected <ArrowRight size={14} aria-hidden="true" /></button>
              <button type="button" className="assistant-icon-button" aria-label="Clear selection" title="Clear selection" onClick={() => setCompareIds([])}><X size={16} aria-hidden="true" /></button>
            </div>
          )}
          <footer className="assistant-footer">
            <form onSubmit={onSubmit} className="assistant-composer">
              <label htmlFor="assistant-input" className="sr-only">Message the shopping assistant</label>
              <textarea id="assistant-input" ref={inputRef} rows={1} value={draft} maxLength={MAX_MESSAGE_LENGTH}
                onChange={event => setDraft(event.target.value)} onKeyDown={onKeyDown} placeholder="What catches your eye?" />
              <button type="submit" disabled={loading || !draft.trim()} aria-label="Send message" className="assistant-send"><ArrowUp size={20} aria-hidden="true" /></button>
            </form>
            <div className="assistant-footer-note"><ShieldCheck size={12} aria-hidden="true" /><p>Please don&apos;t share personal or payment details.</p></div>
            <p className="assistant-disclaimer">AI-generated answers can be wrong. Check product pages.</p>
          </footer>
        </section>
      )}
    </div>
  );
}
