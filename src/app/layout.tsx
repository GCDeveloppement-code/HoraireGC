import type { Metadata, Viewport } from "next";
import "@fontsource-variable/figtree";
import "./globals.css";
import { EnregistrerSW } from "@/components/pwa/EnregistrerSW";

export const metadata: Metadata = {
  title: "Heures Sup GC",
  description: "Le compteur d'heures sup de GC Développement : on ne déclare que les écarts.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Heures Sup" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#d3e9f9",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        {children}
        <EnregistrerSW />
      </body>
    </html>
  );
}
