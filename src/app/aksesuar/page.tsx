import ProductListing from "@/components/ProductListing";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Accessories", description: "Explore accessories and finishing pieces at zeouf." };

export default function AksesuarPage() {
  return <ProductListing mainCategory="Accessories" />;
}
