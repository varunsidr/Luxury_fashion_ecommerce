import ProductListing from "@/components/ProductListing";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Men’s Collection", description: "Explore men’s clothing and new season pieces at zeouf." };

export default function ErkekPage() {
  return <ProductListing mainCategory="Men" />;
}
