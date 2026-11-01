// MODE DÉMO — prévisualisation locale du tableau de bord sans base réelle.
//
// Activé UNIQUEMENT en développement (`next dev`) avec NEXT_PUBLIC_HY_DEMO=1 :
//   NEXT_PUBLIC_HY_DEMO=1 npm run dev
// Le client Supabase est alors remplacé par un faux client qui sert des
// données fictives (lib/demo/fixtures) et ignore les écritures, et
// l'authentification est court-circuitée.
//
// Impossible à déclencher en production : `next build` / `next start` et
// Vercel fixent NODE_ENV à "production", et la condition ci-dessous est
// évaluée à la compilation. Sert aux captures d'écran et à l'itération de
// design (voir docs/DESIGN.md §7).
export const DEMO_MODE =
  process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_HY_DEMO === "1";
