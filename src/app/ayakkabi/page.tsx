import ProductListing from "@/components/ProductListing";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Shoes", description: "Explore shoes and new season styles at zeouf." };

export default function AyakkabiPage() {
  return <ProductListing mainCategory="Shoes" />;
}
