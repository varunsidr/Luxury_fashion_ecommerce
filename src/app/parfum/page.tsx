import ProductListing from "@/components/ProductListing";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Perfume", description: "Explore the fragrance collection at zeouf." };

export default function ParfumPage() {
  return <ProductListing mainCategory="Perfume" />;
}
