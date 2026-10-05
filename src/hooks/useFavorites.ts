"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const fetchFavorites = async (userId: string) => {
      setLoading(true);
      const { data, error } = await supabase
        .from("favorites")
        .select("product_id")
        .eq("user_id", userId);

      if (!error && data) {
        setFavorites(data.map((favorite) => favorite.product_id));
      }
      setLoading(false);
    };

    // Get initial session
    supabase.auth.getSession().then((result) => {
      const session = result?.data?.session;
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchFavorites(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const sessionResult = supabase.auth.onAuthStateChange((_event, session) => {
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
