import type { Metadata } from "next";
import { Poppins, Playfair_Display } from "next/font/google";
import "./globals.css";
import { FavoritesProvider } from "@/context/FavoritesContext";
import { CartProvider } from "@/context/CartContext";
import { AuthPromptProvider } from "@/context/AuthPromptContext";
import { CurrencyProvider } from "@/context/CurrencyContext";
import SiteShell from "@/components/SiteShell";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL) : undefined,
  title: { default: "zeouf | Luxury Fashion & Lifestyle", template: "%s | zeouf" },
  openGraph: { type: "website", siteName: "zeouf", title: "zeouf | Luxury Fashion & Lifestyle", description: "Discover timeless fashion, accessories, and lifestyle pieces." },
  description:
    "Discover the world of zeouf — timeless elegance, haute couture, fine jewellery, and luxury lifestyle.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${poppins.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-poppins">
        <AuthPromptProvider>
          <CurrencyProvider>
            <CartProvider>
              <FavoritesProvider>
                <SiteShell>{children}</SiteShell>
              </FavoritesProvider>
            </CartProvider>
          </CurrencyProvider>
        </AuthPromptProvider>
      </body>
    </html>
  );
}
