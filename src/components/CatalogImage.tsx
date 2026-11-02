import Image, { type ImageProps } from "next/image";
import { productPhotoSource } from "@/lib/productPhotos";

export default function CatalogImage({ src, alt, ...props }: ImageProps) {
  return <Image {...props} alt={alt} src={typeof src === "string" ? productPhotoSource(src) : src} />;
}
