import { useState, useMemo } from "react";

export function useProductSort(products: any[]) {
  const [sortBy, setSortBy] = useState("recommended");

  const sortedProducts = useMemo(() => {
    const arr = [...products];
    if (sortBy === "price-low") {
      arr.sort((a, b) => Number(a.price) - Number(b.price));
    } else if (sortBy === "price-high") {
      arr.sort((a, b) => Number(b.price) - Number(a.price));
    } else if (sortBy === "newest") {
      arr.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }
    return arr;
  }, [products, sortBy]);

  return { sortBy, setSortBy, sortedProducts };
}
