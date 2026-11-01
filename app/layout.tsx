import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Deux familles, des rôles stricts — voir docs/DESIGN.md §4.
//
// Les polices sont servies par nous (next/font) : le rendu est identique sur
// iPhone, sur un PC et sur une capture. Une pile système n'est pas une
// typographie, c'est un pari sur l'appareil du lecteur.
//
// Les noms de variables (`--font-geist`, `--font-instrument`) sont
// volontairement distincts des tokens Tailwind (`--font-sans`, `--font-serif`) :
// une variable CSS qui se référence elle-même est invalide et fait tomber
// toute l'application sur la police par défaut du navigateur (§0).

// TOUT le texte d'interface et TOUS les chiffres. Geist est dessinée pour
// l'écran : chasse serrée, chiffres tabulaires nets, elle tient à 11 px comme
// à 56 px — et sa neutralité laisse la matière (le verre) parler.
const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  display: "swap",
});

// LA VOIX. Titres de page, salutation, phrase de l'agent IA. Une serif
// d'éditeur : c'est elle qui donne au tableau de bord le registre d'un carnet
// de bord plutôt que celui d'un logiciel de gestion.
const instrument = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

// Réservée aux identifiants techniques (numéros masqués, références).
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Harmonie Yacht — Pilotage",
  description:
    "Le tableau de bord d'Harmonie Yacht, piloté par l'agent IA : WhatsApp, réseaux sociaux et finances.",
  formatDetection: { telephone: false, date: false, address: false, email: false },
  appleWebApp: {
    capable: true,
    title: "Harmonie Yacht",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#EDF3FA",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${geist.variable} ${instrument.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
