import manifest from "@/lib/product-photo-manifest.json";

const photos: Readonly<Record<string, { src: string; width: number; height: number }>> = manifest;
const illustrativeSources = new Set(Object.values(photos).map(photo => photo.src));

// Keep catalog records, saved carts and original photos intact. Versioned URLs
// prevent old optimized/contact-sheet responses from masking repaired assets.
export function productPhotoSource(source: string): string {
  return Object.hasOwn(photos, source) ? photos[source].src : source;
}

export function isIllustrativeProductPhoto(source: string): boolean {
  return Object.hasOwn(photos, source) || illustrativeSources.has(source);
}
