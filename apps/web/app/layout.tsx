import type { Metadata } from "next";
import "./globals.css";
import { AppProviders } from "../lib/query-provider";

export const metadata: Metadata = {
  title: "Tres Cielos — Event Master",
  description: "Panel operativo Tres Cielos",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-MX">
      <body className="min-h-screen antialiased">
        <AppProviders>
          <header className="border-b border-moss/20 bg-sand/40 backdrop-blur-sm">
            <div className="mx-auto flex max-w-6xl items-baseline justify-between gap-4 px-6 py-5">
              <div>
                <p className="font-display text-2xl tracking-tight text-moss">
                  Tres Cielos
                </p>
                <p className="text-sm text-ink/70">Event Master System</p>
              </div>
              <nav className="flex gap-4 text-sm">
                <a className="hover:text-leaf" href="/">
                  Inicio
                </a>
                <a className="hover:text-leaf" href="/catalogo">
                  Catálogo
                </a>
                <a className="hover:text-leaf" href="/sandbox/chat">
                  Chat sandbox
                </a>
              </nav>
            </div>
          </header>
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
