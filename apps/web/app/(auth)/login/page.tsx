"use client";

import { Logo } from "@/components/logo";
import { GlassPanel } from "@/components/glass-panel";
import { loginRequest } from "@/lib/auth-api";
import { ApiError } from "@/lib/http";
import { useAuth } from "@/lib/auth-context";
import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("://")) {
    return "/";
  }
  return raw;
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { refreshMe } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await loginRequest(email.trim(), password);
      await refreshMe();
      router.replace(safeNext(params.get("next")));
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && (err.status === 401 || err.status === 429)) {
        setError(
          err.status === 429
            ? "Demasiados intentos. Espera un momento."
            : "Credenciales inválidas.",
        );
      } else {
        setError("No se pudo iniciar sesión. Intenta de nuevo.");
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <GlassPanel strong className="login-card w-full max-w-md px-8 py-10">
      <div className="flex flex-col items-center text-center">
        <Logo size="lg" />
        <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.42em] text-ink/45">
          Event Master System
        </p>
        <h1 className="mt-6 font-display text-2xl text-ink">Iniciar sesión</h1>
        <p className="mt-1 text-sm text-ink/60">
          Acceso exclusivo para el equipo operativo.
        </p>
      </div>
      <form onSubmit={onSubmit} className="mt-8 space-y-4" autoComplete="on">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-xs font-medium text-ink/70">
            Correo
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="glass-input"
          />
        </div>
        <div>
          <label htmlFor="password" className="mb-1.5 block text-xs font-medium text-ink/70">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="glass-input"
          />
        </div>
        {error && (
          <p className="rounded-xl bg-red-50/80 px-3 py-2 text-sm text-red-800" role="alert">
            {error}
          </p>
        )}
        <button type="submit" disabled={pending} className="btn-teal w-full">
          {pending ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </GlassPanel>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <GlassPanel strong className="login-card w-full max-w-md px-8 py-16 text-center text-sm text-ink/50">
          Cargando…
        </GlassPanel>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
