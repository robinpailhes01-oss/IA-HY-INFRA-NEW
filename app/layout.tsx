import type { Metadata, Viewport } from "next";
import { Geist_Mono, Instrument_Sans, Instrument_Serif } from "next/font/google";
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

// Tous les chiffres de l'application.
//
// Revirement assumé : j'avais retiré la mono au motif qu'elle n'avait pas
// d'emploi légitime. C'était vrai de la mono dans la PROSE — « comptable · pas
// la trésorerie » en monospace ressemblait à une erreur système. Mais en
// regardant ce que font les tableaux de bord les mieux dessinés, la mono est
// précisément ce qui donne leur allure aux grands nombres : elle les rend
// précis, alignés, et lisibles comme de la donnée plutôt que comme du texte.
// Sur un tableau de bord financier, c'est aussi le registre juste — celui du
// livre de comptes. Geist Mono plutôt que JetBrains Mono : plus neutre, moins
// de maniérismes, elle ne se fait pas remarquer à côté d'Instrument Sans.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

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
      className={`dark ${instrumentSans.variable} ${instrumentSerif.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
