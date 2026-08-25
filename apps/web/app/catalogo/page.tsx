const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3011";

export default function CatalogoPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-10">
      <section className="space-y-3">
        <h1 className="font-display text-3xl text-moss md:text-4xl">
          Catálogo — sandbox XLS
        </h1>
        <p className="max-w-2xl text-ink/80">
          La UI de importación Excel llegará en una fase posterior. Mientras
          tanto, el contexto del agente se construye así: Excel → Zod{" "}
          <code>CatalogSnapshot</code> → Prisma → tools (nunca montos desde
          pgvector).
        </p>
      </section>

      <section className="space-y-2 border-t border-moss/15 pt-6 text-sm">
        <h2 className="font-display text-xl text-moss">Smoke local</h2>
        <ol className="list-decimal space-y-2 pl-5 text-ink/85">
          <li>
            <code>pnpm --filter @tres-cielos/api sandbox:seed</code>
          </li>
          <li>
            <code>pnpm --filter @tres-cielos/api sandbox:eval</code>
          </li>
          <li>
            Tools:{" "}
            <a
              className="text-leaf underline"
              href={`${apiUrl}/catalog/sandbox/packages`}
            >
              {apiUrl}/catalog/sandbox/packages
            </a>
          </li>
        </ol>
        <p className="pt-2 text-ink/70">
          Detalle:{" "}
          <code>docs/setup/08-sandbox-catalogo-xls.md</code>
        </p>
      </section>
    </div>
  );
}
