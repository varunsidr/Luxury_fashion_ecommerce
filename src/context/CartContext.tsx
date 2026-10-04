"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthPrompt } from "@/context/AuthPromptContext";
import type { User } from "@supabase/supabase-js";
import { CART_STORAGE_KEY, restoreCart, sameVariant, type CartItem } from "@/lib/cartStorage";

export type { CartItem } from "@/lib/cartStorage";

interface CartContextType {
  items: CartItem[];
  addItem: (product: Omit<CartItem, "quantity">, quantity?: number) => void;
  removeItem: (id: string, size: string | null, color?: string | null) => void;
  updateQuantity: (id: string, size: string | null, quantity: number, color?: string | null) => void;
  clearCart: () => void;
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
  const [user, setUser] = useState<User | null>(null);
  const [restored, setRestored] = useState(false);
  const [cartNotice, setCartNotice] = useState<string | null>(null);
  const { openLoginPrompt } = useAuthPrompt();

  useEffect(() => {
    supabase.auth.getSession().then((result: { data: { session: { user: User } | null } }) => {
      const session = result?.data?.session;
      setUser(session?.user ?? null);
    }).catch(() => setUser(null));
    const sessionResult = supabase.auth.onAuthStateChange((_event: string, session: { user: User } | null) => {
      setUser(session?.user ?? null);
    });
    const subscription = sessionResult?.data?.subscription;
    return () => subscription?.unsubscribe?.();
  }, []);

  useEffect(() => {
    let active = true;
    // Restore after mounting, with cleanup for Strict Mode's discarded mount.
    queueMicrotask(() => {
      if (!active) return;
      try {
        const result = restoreCart(localStorage.getItem(CART_STORAGE_KEY));
        setItems(result.items);
        if (result.recovered) setCartNotice("Some saved bag items could not be restored. Please check your bag before checkout.");
      } catch {
        setCartNotice("Your browser cannot save this bag. Items will stay available while this page is open.");
      }
      setRestored(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!restored) return;
    try { localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items)); }
    catch { queueMicrotask(() => setCartNotice("Your browser cannot save this bag. Items will stay available while this page is open.")); }
  }, [items, restored]);

  const addItem = (product: Omit<CartItem, "quantity">, quantity = 1) => {
    if (!restored || !Number.isSafeInteger(quantity) || quantity < 1) return;
    if (!user) {
      openLoginPrompt("You need to sign in to add items to the cart.");
      return;
    }
    setItems(prev => {
      const existing = prev.find(i => sameVariant(i, product.id, product.size, product.color));
      if (existing) {
        if (!Number.isSafeInteger(existing.quantity + quantity)) return prev;
        return prev.map(i =>
          sameVariant(i, product.id, product.size, product.color)
            ? { ...i, quantity: i.quantity + quantity }
            : i
        );
      }
      return [...prev, { ...product, color: product.color || null, quantity }];
    });
    setCartOpen(true);
  };

  const removeItem = (id: string, size: string | null, color?: string | null) => {
    setItems(prev => prev.filter(i => !sameVariant(i, id, size, color)));
  };

  const updateQuantity = (id: string, size: string | null, quantity: number, color?: string | null) => {
    if (!Number.isSafeInteger(quantity)) return;
    if (quantity < 1) {
      removeItem(id, size, color);
      return;
    }
    setItems(prev =>
      prev.map(i => sameVariant(i, id, size, color) ? { ...i, quantity } : i)
    );
  };

  const clearCart = () => setItems([]);

  const totalCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, totalCount, totalPrice, cartOpen, setCartOpen, cartNotice }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
