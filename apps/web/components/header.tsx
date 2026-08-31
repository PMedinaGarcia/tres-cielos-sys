"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { RolUsuario } from "@tres-cielos/shared";
import { Logo } from "./logo";
import { useAuth } from "@/lib/auth-context";

const links = [
  { href: "/", label: "Inicio" },
  { href: "/catalogo", label: "Catálogo" },
  { href: "/sandbox/chat", label: "Chat sandbox" },
  { href: "/crm", label: "CRM" },
];

const ROL_LABEL: Record<RolUsuario, string> = {
  admin: "Administrador",
  coordinador: "Coordinador",
  asesor: "Asesor",
};

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export function Header() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 border-b border-white/60 bg-white/40 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-4 md:px-8 lg:flex-row lg:items-center lg:gap-0">
        <div className="flex items-center justify-between gap-6 lg:contents">
          <Link
            href="/"
            className="flex shrink-0 items-center gap-4 lg:border-r lg:border-ink/10 lg:pr-8"
          >
            <Logo size="sm" />
            <span className="hidden flex-col justify-center sm:flex">
              <span className="font-display text-[15px] leading-none text-ink">
                Event Master
              </span>
              <span className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.28em] text-ink/40">
                Tres Cielos
              </span>
            </span>
          </Link>

          <div className="flex shrink-0 items-center gap-3 lg:order-last lg:border-l lg:border-ink/10 lg:pl-8">
            {user?.rol === "admin" && (
              <Link
                href="/admin/usuarios"
                className={`whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] font-medium text-white shadow-sm transition ${
                  pathname.startsWith("/admin")
                    ? "bg-teal"
                    : "bg-teal/90 hover:bg-teal"
                }`}
              >
                Crear usuarios
              </Link>
            )}
            {user && (
              <div className="hidden min-w-0 flex-col items-end md:flex">
                <span className="max-w-[14rem] truncate text-sm font-medium leading-none text-ink">
                  {user.nombre}
                </span>
                <span className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.2em] text-ink/40">
                  {ROL_LABEL[user.rol]}
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={() => void logout()}
              className="rounded-full px-3 py-2 text-[13px] text-ink/45 transition hover:bg-white/55 hover:text-teal"
            >
              Cerrar sesión
            </button>
          </div>
        </div>

        <nav aria-label="Principal" className="min-w-0 lg:flex-1 lg:px-8">
          <div className="flex w-max max-w-full items-center gap-0.5 overflow-x-auto rounded-full bg-white/40 p-1 ring-1 ring-inset ring-white/80 [scrollbar-width:none] lg:mx-auto [&::-webkit-scrollbar]:hidden">
            {links.map((link) => {
              const active = isActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`whitespace-nowrap rounded-full px-3.5 py-2 text-[13px] tracking-wide transition ${
                    active
                      ? "bg-white font-medium text-teal shadow-sm"
                      : "text-ink/55 hover:bg-white/60 hover:text-ink"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </header>
  );
}
