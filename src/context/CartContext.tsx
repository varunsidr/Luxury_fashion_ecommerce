"use client";

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthPrompt } from "@/context/AuthPromptContext";
import type { User } from "@supabase/supabase-js";
import { CART_STORAGE_KEY, cartStorageKey, restoreCart, sameVariant, type CartItem } from "@/lib/cartStorage";

export type { CartItem } from "@/lib/cartStorage";

interface CartContextType {
  items: CartItem[];
  addItem: (product: Omit<CartItem, "quantity">, quantity?: number, expectedUserId?: string) => boolean;
  removeItem: (id: string, size: string | null, color?: string | null) => void;
  updateQuantity: (id: string, size: string | null, quantity: number, color?: string | null) => void;
  clearCart: (expectedUserId?: string) => void;
  ownerId: string | null;
  totalCount: number;
  totalPrice: number;
  cartOpen: boolean;
  setCartOpen: (open: boolean) => void;
  cartNotice: string | null;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const userRef = useRef<User | null>(null);
  const itemsRef = useRef<CartItem[]>([]);
  const restoredRef = useRef(false);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const memoryCarts = useRef(new Map<string, CartItem[]>());
  const [cartNotice, setCartNotice] = useState<string | null>(null);
  const { openLoginPrompt } = useAuthPrompt();

  useEffect(() => {
    let active = true, authChanged = false;
    const selectAccount = (user: User | null) => {
      if (!active || restoredRef.current && userRef.current?.id === user?.id) return;
      restoredRef.current = false;
      userRef.current = user;
      let next: CartItem[] = [];
      let notice: string | null = null;
      try {
        // Legacy bags have no owner. Never assign them to whoever signs in next.
        if (localStorage.getItem(CART_STORAGE_KEY) !== null) {
          localStorage.removeItem(CART_STORAGE_KEY);
          notice = "Bags are now saved per account. Please add any items from your previous shared bag again.";
        }
        if (user) {
          const result = restoreCart(localStorage.getItem(cartStorageKey(user.id)));
          next = memoryCarts.current.get(user.id) ?? result.items;
          if (result.recovered) notice = "Some saved bag items could not be restored. Please check your bag before checkout.";
        }
      } catch {
        if (user) next = memoryCarts.current.get(user.id) ?? [];
        notice = "Your browser cannot save this bag. Items will stay available while this page is open.";
      }
      itemsRef.current = next;
      if (user) memoryCarts.current.set(user.id, next);
      setItems(next);
      setOwnerId(user?.id ?? null);
      setCartOpen(false);
      setCartNotice(notice);
      restoredRef.current = true;
    };
    supabase.auth.getSession().then((result: { data: { session: { user: User } | null } }) => {
      const session = result?.data?.session;
      if (!authChanged) selectAccount(session?.user ?? null);
    }).catch(() => { if (!authChanged) selectAccount(null); });
    const sessionResult = supabase.auth.onAuthStateChange((_event: string, session: { user: User } | null) => {
      authChanged = true;
      selectAccount(session?.user ?? null);
    });
    const subscription = sessionResult?.data?.subscription;
    return () => { active = false; subscription?.unsubscribe?.(); };
  }, []);

  const changeItems = (next: CartItem[]) => {
    const user = userRef.current;
    if (!user || !restoredRef.current) return;
    itemsRef.current = next;
    memoryCarts.current.set(user.id, next);
    setItems(next);
    // Write with the owner captured at mutation time; a later auth event cannot
    // redirect a pending render's persistence into another account's bag.
    try { localStorage.setItem(cartStorageKey(user.id), JSON.stringify(next)); }
    catch { setCartNotice("Your browser cannot save this bag. Items will stay available while this page is open."); }
  };

  const addItem = (product: Omit<CartItem, "quantity">, quantity = 1, expectedUserId?: string) => {
    if (!restoredRef.current || !Number.isSafeInteger(quantity) || quantity < 1) return false;
    if (!userRef.current || expectedUserId && userRef.current.id !== expectedUserId) {
      openLoginPrompt("You need to sign in to add items to the cart.");
      return false;
    }
    const previous = itemsRef.current;
    const existing = previous.find(i => sameVariant(i, product.id, product.size, product.color));
    if (existing && !Number.isSafeInteger(existing.quantity + quantity)) return false;
    changeItems(existing ? previous.map(i => sameVariant(i, product.id, product.size, product.color)
      ? { ...i, quantity: i.quantity + quantity } : i)
      : [...previous, { ...product, color: product.color || null, quantity }]);
    setCartOpen(true);
    return true;
  };

  const removeItem = (id: string, size: string | null, color?: string | null) => {
    changeItems(itemsRef.current.filter(i => !sameVariant(i, id, size, color)));
  };

  const updateQuantity = (id: string, size: string | null, quantity: number, color?: string | null) => {
    if (!Number.isSafeInteger(quantity)) return;
    if (quantity < 1) {
      removeItem(id, size, color);
      return;
    }
    changeItems(itemsRef.current.map(i => sameVariant(i, id, size, color) ? { ...i, quantity } : i));
  };

  const clearCart = (expectedUserId?: string) => {
    if (expectedUserId && userRef.current?.id !== expectedUserId) return;
    changeItems([]);
  };

  const totalCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, ownerId, addItem, removeItem, updateQuantity, clearCart, totalCount, totalPrice, cartOpen, setCartOpen, cartNotice }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
