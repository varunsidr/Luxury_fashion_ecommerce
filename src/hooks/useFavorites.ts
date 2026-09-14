"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then((result: any) => {
      const session = result?.data?.session;
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchFavorites(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const sessionResult: any = supabase.auth.onAuthStateChange((_event: any, session: any) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchFavorites(session.user.id);
      } else {
        setFavorites([]);
        setLoading(false);
      }
    });

    return () => {
      sessionResult?.data?.subscription?.unsubscribe?.();
    };
  }, []);

  const fetchFavorites = async (userId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("favorites")
      .select("product_id")
      .eq("user_id", userId);

    if (!error && data) {
      setFavorites(data.map((f: any) => f.product_id));
    }
    setLoading(false);
  };

  const toggleFavorite = async (productId: string) => {
    if (!user) {
      alert("Please sign in to add items to favorites.");
      return;
    }

    const isFav = favorites.includes(productId);

    if (isFav) {
      // Remove from favorites
      const { error } = await supabase
        .from("favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("product_id", productId);

      if (!error) {
        setFavorites(prev => prev.filter(id => id !== productId));
      }
    } else {
      // Add to favorites
      const { error } = await supabase
        .from("favorites")
        .insert({ user_id: user.id, product_id: productId });

      if (!error) {
        setFavorites(prev => [...prev, productId]);
      }
    }
  };

  const isFavorite = (productId: string) => favorites.includes(productId);

  return {
    favorites,
    isFavorite,
    toggleFavorite,
    loading,
    favoritesCount: favorites.length
  };
}
