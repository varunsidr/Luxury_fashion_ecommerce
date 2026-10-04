import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: { root: process.cwd() },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "xiunlqsyghlmiedespim.supabase.co",
      },
    ],
  },
  async redirects() {
    return [
      { source: "/kadin/elbise", destination: "/women/dress", permanent: true },
      { source: "/kadin/bluz", destination: "/women/blouse", permanent: true },
      { source: "/kadin/ceket", destination: "/women/jacket", permanent: true },
      { source: "/kadin/etek", destination: "/women/skirt", permanent: true },
      { source: "/kadin/pantolon", destination: "/women/trousers", permanent: true },
      { source: "/kadin/yeni", destination: "/women/new-arrivals", permanent: true },
      { source: "/kadin/cok-satan", destination: "/women/best-sellers", permanent: true },
      { source: "/kadin/koleksiyon", destination: "/women/collection", permanent: true },
      { source: "/erkek/takim", destination: "/men/suits", permanent: true },
      { source: "/erkek/gomlek", destination: "/men/shirts", permanent: true },
      { source: "/erkek/pantolon", destination: "/men/trousers", permanent: true },
      { source: "/erkek/ceket", destination: "/men/jacket", permanent: true },
      { source: "/erkek/yeni", destination: "/men/new-arrivals", permanent: true },
      { source: "/erkek/cok-satan", destination: "/men/best-sellers", permanent: true },
      { source: "/erkek/koleksiyon", destination: "/men/collection", permanent: true },
      { source: "/kadin/:path*", destination: "/women/:path*", permanent: true },
      { source: "/erkek/:path*", destination: "/men/:path*", permanent: true },
      { source: "/kadin", destination: "/women", permanent: true },
      { source: "/erkek", destination: "/men", permanent: true },
      { source: "/parfum/:path*", destination: "/perfume/:path*", permanent: true },
      { source: "/ayakkabi/:path*", destination: "/shoes/:path*", permanent: true },
      { source: "/canta/:path*", destination: "/bags/:path*", permanent: true },
      { source: "/aksesuar/:path*", destination: "/accessories/:path*", permanent: true },
      { source: "/makyaj/:path*", destination: "/makeup/:path*", permanent: true },
      { source: "/parfum", destination: "/perfume", permanent: true },
      { source: "/ayakkabi", destination: "/shoes", permanent: true },
      { source: "/canta", destination: "/bags", permanent: true },
      { source: "/aksesuar", destination: "/accessories", permanent: true },
      { source: "/makyaj", destination: "/makeup", permanent: true },
      { source: "/favorilerim", destination: "/favorites", permanent: true },
      { source: "/arama", destination: "/search", permanent: true },
      { source: "/kullanim-kosullari", destination: "/terms", permanent: true },
    ];
  },
  async rewrites() {
    return [
      { source: "/women", destination: "/kadin" },
      { source: "/women/:path*", destination: "/kadin/:path*" },
      { source: "/men", destination: "/erkek" },
      { source: "/men/:path*", destination: "/erkek/:path*" },
      { source: "/perfume", destination: "/parfum" },
      { source: "/perfume/:path*", destination: "/parfum/:path*" },
      { source: "/shoes", destination: "/ayakkabi" },
      { source: "/shoes/:path*", destination: "/ayakkabi/:path*" },
      { source: "/bags", destination: "/canta" },
      { source: "/bags/:path*", destination: "/canta/:path*" },
      { source: "/accessories", destination: "/aksesuar" },
      { source: "/accessories/:path*", destination: "/aksesuar/:path*" },
      { source: "/makeup", destination: "/makyaj" },
      { source: "/makeup/:path*", destination: "/makyaj/:path*" },
      { source: "/favorites", destination: "/favorilerim" },
      { source: "/search", destination: "/arama" },
      { source: "/terms", destination: "/kullanim-kosullari" },
    ];
  },
};

export default nextConfig;
