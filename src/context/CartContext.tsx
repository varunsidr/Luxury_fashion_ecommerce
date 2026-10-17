"use client";

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthPrompt } from "@/context/AuthPromptContext";
import type { User } from "@supabase/supabase-js";
import { CART_STORAGE_KEY, restoreCart, sameVariant, type CartItem } from "@/lib/cartStorage";

export type { CartItem } from "@/lib/cartStorage";

interface CartContextType {
  items: CartItem[];
  addItem: (product: Omit<CartItem, "quantity">, quantity?: number, expectedUserId?: string) => boolean;
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
  const userRef = useRef<User | null>(null);
  const itemsRef = useRef<CartItem[]>([]);
  const restoredRef = useRef(false);
  const [restored, setRestored] = useState(false);
  const [cartNotice, setCartNotice] = useState<string | null>(null);
  const { openLoginPrompt } = useAuthPrompt();

  useEffect(() => {
    let active = true, authChanged = false;
    supabase.auth.getSession().then((result: { data: { session: { user: User } | null } }) => {
      const session = result?.data?.session;
      if (active && !authChanged) userRef.current = session?.user ?? null;
    }).catch(() => { if (active && !authChanged) userRef.current = null; });
    const sessionResult = supabase.auth.onAuthStateChange((_event: string, session: { user: User } | null) => {
      authChanged = true;
      userRef.current = session?.user ?? null;
    });
    const subscription = sessionResult?.data?.subscription;
    return () => { active = false; subscription?.unsubscribe?.(); };
  }, []);

  useEffect(() => {
    let active = true;
    // Restore after mounting, with cleanup for Strict Mode's discarded mount.
    queueMicrotask(() => {
      if (!active) return;
      try {
        const result = restoreCart(localStorage.getItem(CART_STORAGE_KEY));
        itemsRef.current = result.items;
        setItems(result.items);
        if (result.recovered) setCartNotice("Some saved bag items could not be restored. Please check your bag before checkout.");
      } catch {
        setCartNotice("Your browser cannot save this bag. Items will stay available while this page is open.");
      }
      restoredRef.current = true;
      setRestored(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!restored) return;
    try { localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items)); }
    catch { queueMicrotask(() => setCartNotice("Your browser cannot save this bag. Items will stay available while this page is open.")); }
  }, [items, restored]);

  const changeItems = (next: CartItem[]) => { itemsRef.current = next; setItems(next); };

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

  const clearCart = () => changeItems([]);

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
