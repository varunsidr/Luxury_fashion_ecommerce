"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { useAuthPrompt } from "@/context/AuthPromptContext";

interface FavoritesContextType {
  favorites: string[];
  isFavorite: (productId: string) => boolean;
  toggleFavorite: (productId: string) => Promise<void>;
  loading: boolean;
  favoritesCount: number;
}

const FavoritesContext = createContext<FavoritesContextType | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const { openLoginPrompt } = useAuthPrompt();

  const fetchFavorites = async (userId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("favorites")
      .select("product_id")
      .eq("user_id", userId);

    if (!error && data) {
      setFavorites(data.map((favorite: { product_id: string }) => favorite.product_id));
    }
    setLoading(false);
  };

  useEffect(() => {
    supabase.auth.getSession().then((result: any) => {
      const session = result?.data?.session;
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchFavorites(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const sessionResult: any = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchFavorites(session.user.id);
      } else {
        setFavorites([]);
        setLoading(false);
      }
    });

    return () => sessionResult?.data?.subscription?.unsubscribe?.();
  }, []);

  const toggleFavorite = async (productId: string) => {
    if (!user) {
      openLoginPrompt("You need to sign in to add items to favorites.");
      return;
    }

    const isFav = favorites.includes(productId);

    if (isFav) {
      const { error } = await supabase
        .from("favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("product_id", productId);

      if (!error) {
        setFavorites(prev => prev.filter(id => id !== productId));
      }
    } else {
      const { error } = await supabase
        .from("favorites")
        .insert({ user_id: user.id, product_id: productId });

      if (!error) {
        setFavorites(prev => [...prev, productId]);
      }
    }
  };

  const isFavorite = (productId: string) => favorites.includes(productId);

  return (
    <FavoritesContext.Provider value={{ favorites, isFavorite, toggleFavorite, loading, favoritesCount: favorites.length }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used within FavoritesProvider");
  return ctx;
}
