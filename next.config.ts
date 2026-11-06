import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Déploiement de démonstration : ne jamais être indexé.
  async headers() {
    if (process.env.NEXT_PUBLIC_HY_DEMO_DEPLOY !== "1") return [];
    return [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }] }];
  },
};

export default nextConfig;
