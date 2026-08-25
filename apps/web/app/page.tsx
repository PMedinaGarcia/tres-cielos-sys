const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3011";

async function fetchHealth(): Promise<{
  ok: boolean;
  body?: unknown;
  error?: string;
}> {
  try {
    const res = await fetch(`${apiUrl}/health`, { cache: "no-store" });
    const body = await res.json();
    return { ok: res.ok, body };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "fetch failed",
    };
  }
}

export default async function HomePage() {
  const health = await fetchHealth();

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-6 py-10">
      <section className="space-y-3">
        <h1 className="font-display text-4xl text-moss md:text-5xl">
          Panel operativo
        </h1>
        <p className="max-w-2xl text-lg text-ink/80">
          Scaffold mínimo listo para desarrollo. API en{" "}
          <code className="rounded bg-moss/10 px-1.5 py-0.5 text-sm">
            {apiUrl}
          </code>
          , panel en puerto <strong>3010</strong>.
        </p>
      </section>

      <section className="space-y-2 border-t border-moss/15 pt-6">
        <h2 className="font-display text-xl text-moss">Salud del API</h2>
        {health.ok ? (
          <pre className="overflow-x-auto rounded-md bg-ink/90 p-4 text-sm text-sand">
            {JSON.stringify(health.body, null, 2)}
          </pre>
        ) : (
          <p className="text-sm text-red-800">
            No se pudo contactar el API: {health.error}. Arranca{" "}
            <code>pnpm --filter @tres-cielos/api dev</code>.
          </p>
        )}
      </section>
    </div>
  );
}
