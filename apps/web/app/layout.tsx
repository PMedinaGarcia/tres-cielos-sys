import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { AppProviders } from "../lib/query-provider";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Tres Cielos — Event Master",
  description: "Panel operativo Tres Cielos",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-MX">
      <body className={`${outfit.variable} min-h-screen font-body antialiased`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
