"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./logo";
import { useAuth } from "@/lib/auth-context";

const links = [
  { href: "/", label: "Inicio" },
  { href: "/catalogo", label: "Catálogo" },
  { href: "/sandbox/chat", label: "Chat sandbox" },
  { href: "/crm", label: "CRM" },
];

export function Header() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 border-b border-white/50 bg-white/35 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center gap-4 px-6 py-3">
        <Link href="/" className="flex shrink-0 items-center gap-3">
          <Logo size="sm" />
          <span className="hidden text-[11px] font-medium uppercase tracking-[0.28em] text-ink/55 sm:block">
            Event Master
          </span>
        </Link>
        <nav className="flex min-w-0 flex-1 flex-wrap items-center gap-1 text-sm">
          {links.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-full px-3 py-1.5 transition ${
                  active
                    ? "bg-white/70 text-teal"
                    : "text-ink/70 hover:bg-white/40 hover:text-teal"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          {user?.rol === "admin" && (
            <Link
              href="/admin/usuarios"
              className={`rounded-full px-3 py-1.5 transition ${
                pathname.startsWith("/admin")
                  ? "bg-white/70 text-teal"
                  : "text-ink/70 hover:bg-white/40 hover:text-teal"
              }`}
            >
              Usuarios
            </Link>
          )}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {user && (
            <span className="hidden max-w-[9rem] truncate text-xs text-ink/55 md:block">
              {user.nombre}
            </span>
          )}
          <button
            type="button"
            onClick={() => void logout()}
            className="inline-flex items-center justify-center rounded-xl border border-white/70 bg-white/55 px-3 py-1.5 text-sm font-medium text-ink shadow-sm transition hover:bg-white/80 hover:text-teal"
          >
            Cerrar sesión
          </button>
        </div>
      </div>
    </header>
  );
}
