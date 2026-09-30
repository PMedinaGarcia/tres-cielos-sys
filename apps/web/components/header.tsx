"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { RolUsuario } from "@tres-cielos/shared";
import { Logo } from "./logo";
import { useAuth } from "@/lib/auth-context";

const links = [
  { href: "/", label: "Inicio", shortLabel: "Inicio" },
  { href: "/catalogo", label: "Catálogo", shortLabel: "Catálogo" },
  { href: "/sandbox/chat", label: "Chat sandbox", shortLabel: "Chat" },
  { href: "/crm", label: "CRM", shortLabel: "CRM" },
  { href: "/bandeja", label: "Bandeja", shortLabel: "Bandeja" },
] as const;

const ROL_LABEL: Record<RolUsuario, string> = {
  admin: "Administrador",
  coordinador: "Coordinador",
  asesor: "Asesor",
};

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

function userInitials(nombre: string) {
  const parts = nombre.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
  }
  return nombre.trim().slice(0, 2).toUpperCase();
}

function SessionCluster({
  className = "",
  prominent = false,
}: {
  className?: string;
  prominent?: boolean;
}) {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const adminLink = user?.rol === "admin" && (
    <Link
      href="/admin/usuarios"
      className={`whitespace-nowrap rounded-lg px-3 py-2 text-[12px] font-semibold text-white shadow-sm transition sm:text-[13px] ${
        pathname.startsWith("/admin")
          ? "bg-teal ring-2 ring-teal/25"
          : "bg-teal/90 hover:bg-teal hover:shadow-md"
      } ${prominent ? "w-full text-center" : "rounded-xl px-2.5 py-1.5 sm:rounded-full sm:px-3.5 sm:py-2"}`}
    >
      <span className="sm:hidden">Usuarios</span>
      <span className="hidden sm:inline">Crear usuarios</span>
    </Link>
  );

  const logoutButton = (
    <button
      type="button"
      onClick={() => void logout()}
      className={
        prominent
          ? "shrink-0 rounded-lg px-3 py-2 text-[12px] font-medium text-ink/50 transition hover:bg-ink/[0.04] hover:text-ink"
          : "rounded-xl px-2.5 py-1.5 text-[12px] text-ink/45 transition hover:bg-white/55 hover:text-teal sm:rounded-full sm:px-3 sm:py-2 sm:text-[13px]"
      }
    >
      <span className="sm:hidden">Salir</span>
      <span className="hidden sm:inline">Cerrar sesión</span>
    </button>
  );

  if (prominent) {
    return (
      <div
        className={`flex shrink-0 items-stretch gap-0 overflow-hidden rounded-2xl bg-white/55 shadow-[0_4px_24px_rgba(26,39,64,0.06)] ring-1 ring-white/80 ${className}`.trim()}
        aria-label="Sesión y administración"
      >
        {user?.rol === "admin" && (
          <div className="flex flex-col justify-center gap-1 border-r border-ink/[0.06] bg-teal/[0.06] px-3 py-2">
            <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-teal/70">
              Admin
            </span>
            {adminLink}
          </div>
        )}

        {user && (
          <div className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal/20 to-celeste/40 text-[11px] font-bold tracking-wide text-teal ring-2 ring-white"
              aria-hidden
            >
              {userInitials(user.nombre)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-semibold leading-tight text-ink">
                {user.nombre}
              </p>
              <span className="mt-1 inline-flex rounded-md bg-ink/[0.05] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/55">
                {ROL_LABEL[user.rol]}
              </span>
            </div>
          </div>
        )}

        <div className="flex items-center border-l border-ink/[0.06] bg-white/30 px-1 py-1">
          {logoutButton}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`flex shrink-0 items-center gap-1 rounded-2xl bg-white/45 p-1 ring-1 ring-inset ring-white/75 sm:gap-1.5 ${className}`.trim()}
    >
      {user?.rol === "admin" && (
        <>
          {adminLink}
          <span
            className="hidden h-5 w-px shrink-0 bg-ink/10 sm:block"
            aria-hidden
          />
        </>
      )}

      {user && (
        <div className="hidden min-w-0 items-center gap-2 px-1 sm:flex sm:max-w-[11rem] md:max-w-[14rem]">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal/15 text-[10px] font-bold text-teal"
            aria-hidden
          >
            {userInitials(user.nombre)}
          </span>
          <div className="min-w-0 flex flex-col items-end">
            <span className="max-w-full truncate text-sm font-medium leading-none text-ink">
              {user.nombre}
            </span>
            <span className="mt-1 text-[10px] font-medium uppercase tracking-[0.18em] text-ink/40">
              {ROL_LABEL[user.rol]}
            </span>
          </div>
        </div>
      )}

      {logoutButton}
    </div>
  );
}

export function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-white/60 bg-white/40 backdrop-blur-xl">
      <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-6">
          <div className="flex min-w-0 items-center justify-between gap-3 lg:shrink-0">
            <Link
              href="/"
              className="flex min-w-0 items-center gap-3 sm:gap-4 lg:border-r lg:border-ink/10 lg:pr-6"
            >
              <Logo size="sm" />
              <span className="hidden min-w-0 flex-col justify-center sm:flex">
                <span className="truncate font-display text-[15px] leading-none text-ink">
                  Event Master
                </span>
                <span className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.28em] text-ink/40">
                  Tres Cielos
                </span>
              </span>
            </Link>

            <SessionCluster className="lg:hidden" />
          </div>

          <nav
            aria-label="Principal"
            className="min-w-0 lg:min-w-[280px] lg:flex-1 lg:px-2"
          >
            <div className="flex w-full items-stretch gap-0.5 overflow-x-auto rounded-2xl bg-white/40 p-1 ring-1 ring-inset ring-white/80 sm:w-max sm:max-w-full sm:items-center lg:mx-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {links.map((link) => {
                const active = isActive(pathname, link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex-1 whitespace-nowrap rounded-xl px-2 py-2 text-center text-[12px] tracking-wide transition sm:flex-none sm:rounded-full sm:px-3.5 sm:py-2 sm:text-[13px] sm:text-left ${
                      active
                        ? "bg-white font-medium text-teal shadow-sm"
                        : "text-ink/55 hover:bg-white/60 hover:text-ink"
                    }`}
                  >
                    <span className="sm:hidden">{link.shortLabel}</span>
                    <span className="hidden sm:inline">{link.label}</span>
                  </Link>
                );
              })}
            </div>
          </nav>

          <SessionCluster className="hidden lg:flex" prominent />
        </div>
      </div>
    </header>
  );
}
