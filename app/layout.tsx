import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist_Mono, Plus_Jakarta_Sans } from "next/font/google";
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

// LES TITRES. Bricolage Grotesque remplace la serif éditoriale : même ambition
// de caractère, mais dans un registre contemporain qui tient à toutes les
// tailles. Ses terminaisons coupées en biais et son axe optique variable lui
// donnent une personnalité qu'aucune grotesque neutre n'a — c'est ce qui
// empêche l'interface de ressembler à un gabarit.
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
});

// LE TEXTE. Plus Jakarta Sans : géométrique mais chaleureuse, excellente à
// 11 px en capitales espacées — exactement l'emploi principal ici.
const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
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
      className={`dark ${jakarta.variable} ${bricolage.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
