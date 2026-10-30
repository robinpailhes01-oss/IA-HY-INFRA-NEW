import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Instrument_Serif } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Trois fontes, trois rôles stricts — voir docs/DESIGN.md §4.
//
// On ne s'appuie plus sur une pile système (`-apple-system`, 'SF Pro Display').
// Une pile système n'est pas une typographie : c'est un pari sur l'appareil du
// lecteur, et quand le pari échoue on se retrouve en Times — ce qui est
// exactement ce qui est arrivé. Ces trois polices sont servies par nous, donc
// le rendu est identique sur iPhone, sur un PC et sur une capture d'écran.
//
// Les noms de variables sont volontairement distincts des tokens Tailwind
// (`--font-sans`, `--font-mono`) : une variable CSS qui se référence
// elle-même est invalide et fait tomber toute l'application sur la police par
// défaut du navigateur.

// La fonte de travail. Étroite : sur une carte KPI de 150 px, un libellé y
// tient en deux lignes là où Inter en demandait trois.
const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
  display: "swap",
});

// L'accent éditorial, deux emplois par écran : titre de page et titre du
// panneau signature. Un seul poids, donc un chargement négligeable.
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

// Pas de troisième police téléchargée. Le rôle « colonne de données alignée »
// est tenu par la mono système (`ui-monospace` → SF Mono sur iPhone et Mac),
// voir --font-mono dans globals.css. Les chiffres de l'interface sont de toute
// façon en Instrument Sans à chasse fixe : faire télécharger une police de plus
// sur un réseau mobile pour des cas qui n'existent pas encore serait du poids
// gratuit. À réintroduire ici le jour où un vrai tableau de données l'exige.

export const metadata: Metadata = {
  title: "Harmonie Yacht — Dashboard",
  description: "Pilotage des leads, réservations, finances et marketing d'Harmonie Yacht.",
  formatDetection: { telephone: false, date: false, address: false, email: false },
  appleWebApp: {
    capable: true,
    title: "Harmonie Yacht",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#06121F",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`dark ${instrumentSans.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
