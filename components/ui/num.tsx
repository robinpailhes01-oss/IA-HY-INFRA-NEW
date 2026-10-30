import { cn } from "@/lib/utils";

// Affiche un nombre formaté en français dans une chasse fixe, sans les trous.
//
// `Intl.NumberFormat('fr-FR')` sépare les milliers par U+202F (espace fine
// insécable) et précède le € d'un U+00A0. Dans une police monospace, TOUT
// caractère occupe la même chasse, espaces compris : « 49 800 € » s'affiche
// « 49  800  € ». L'œil lit alors deux nombres au lieu d'un.
//
// `word-spacing` ne règle rien : la spécification CSS ne compte que U+0020
// comme séparateur de mots, pas U+202F.
//
// La correction consiste à rendre les seuls séparateurs dans la police
// proportionnelle, où une espace fine est enfin fine. Le caractère reste bien
// présent dans le document : le copier-coller et les lecteurs d'écran
// obtiennent le nombre exact, ce qu'un faux blanc de largeur fixe aurait cassé.
const SEPARATEURS = /([   ]+)/;

export function Num({ children, className }: { children: string; className?: string }) {
  return (
    <span className={cn(className)}>
      {children.split(SEPARATEURS).map((morceau, i) =>
        SEPARATEURS.test(morceau) ? (
          <span key={i} className="num-sep">
            {morceau}
          </span>
        ) : (
          morceau
        ),
      )}
    </span>
  );
}
