import ProductListing from "@/components/ProductListing";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Makeup", description: "Explore makeup and beauty products at zeouf." };

export default function MakyajPage() {
  return <ProductListing mainCategory="Makeup" />;
}
