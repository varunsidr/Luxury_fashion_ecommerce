import ProductListing from "@/components/ProductListing";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Women’s Collection", description: "Explore women’s clothing and new season pieces at zeouf." };

export default function KadinPage() {
  return <ProductListing mainCategory="Women" />;
}
