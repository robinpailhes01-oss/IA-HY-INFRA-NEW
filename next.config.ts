import type { NextConfig } from "next";

// Branche de DÉMONSTRATION (`demo-video`) : sur Vercel, uniquement pour un
// déploiement d'APERÇU de cette branche, le mode démo (fausses données, pas de
// connexion, aucun envoi réel) est activé sans aucune variable à régler. Une
// production — de n'importe quel projet — ne l'active jamais.
const isDemoPreview =
  process.env.VERCEL_ENV === "preview" && process.env.VERCEL_GIT_COMMIT_REF === "demo-video";

const nextConfig: NextConfig = {
  env: isDemoPreview ? { NEXT_PUBLIC_HY_DEMO: "1", NEXT_PUBLIC_HY_DEMO_DEPLOY: "1" } : {},
  // Un aperçu de démonstration ne doit jamais être indexé.
  async headers() {
    if (!isDemoPreview && process.env.NEXT_PUBLIC_HY_DEMO_DEPLOY !== "1") return [];
    return [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }] }];
  },
};

export default nextConfig;
