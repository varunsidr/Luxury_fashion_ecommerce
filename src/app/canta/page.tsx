import ProductListing from "@/components/ProductListing";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Bags", description: "Explore bags and accessories at zeouf." };

export default function CantaPage() {
  return <ProductListing mainCategory="Bags" />;
}
