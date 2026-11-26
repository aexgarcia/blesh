import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { getSiteConfig } from "@/infrastructure/seo/server";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteConfig().origin),
  robots: { index: getSiteConfig().indexable, follow: getSiteConfig().indexable },
  title: {
    default: "BLESH | Ropa streetwear hecha en Perú",
    template: "%s | BLESH",
  },
  description: "BLESH — ropa streetwear hecha en Perú.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-PE" className={`${inter.variable} h-full antialiased`}>
      {/* Algunas extensiones añaden atributos al body antes de hidratar (p. ej. cz-shortcut-listen).
          La tolerancia se limita a este elemento; los componentes hijos siguen verificándose. */}
      <body suppressHydrationWarning className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
