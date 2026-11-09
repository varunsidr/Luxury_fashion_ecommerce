"use client";

import Link from "next/link";

export default function ProductRouteError({ retry }: { error: unknown; retry: () => void }) {
  return <div className="mx-auto max-w-2xl px-6 pb-24 pt-40 text-center">
    <h1 className="font-playfair text-3xl">Product temporarily unavailable</h1>
    <p role="alert" className="my-6 text-sm text-neutral-600">We could not load this product. Please try again.</p>
    <button onClick={retry} className="min-h-11 border border-neutral-800 px-6 text-sm">Retry product</button>
    <Link href="/" className="ml-6 inline-block py-3 text-sm underline">Continue browsing</Link>
  </div>;
}
