import { GlassPanel } from "@/components/glass-panel";
import { publicApiUrl } from "@/lib/api-url";

const apiUrl = publicApiUrl();

export default function CatalogoPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-10">
      <GlassPanel className="space-y-3 px-8 py-8">
        <h1 className="font-display text-3xl text-ink md:text-4xl">
          Catálogo — sandbox XLS
        </h1>
        <p className="max-w-2xl text-ink/75">
          La UI de importación Excel llegará en una fase posterior. Mientras
          tanto, el contexto del agente se construye así: Excel → Zod{" "}
          <code className="rounded bg-white/60 px-1">CatalogSnapshot</code> →
          Prisma → tools (nunca montos desde pgvector).
        </p>
      </GlassPanel>

      <GlassPanel className="space-y-3 px-8 py-8 text-sm">
        <h2 className="font-display text-xl text-teal">Smoke local</h2>
        <ol className="list-decimal space-y-2 pl-5 text-ink/80">
          <li>
            <code>pnpm --filter @tres-cielos/api sandbox:seed</code>
          </li>
          <li>
            <code>pnpm --filter @tres-cielos/api sandbox:eval</code>
          </li>
          <li>
            Tools:{" "}
            <a
              className="text-teal underline"
              href={`${apiUrl}/catalog/sandbox/packages`}
            >
              {apiUrl}/catalog/sandbox/packages
            </a>
          </li>
        </ol>
        <p className="pt-2 text-ink/60">
          Detalle: <code>docs/setup/08-sandbox-catalogo-xls.md</code>
        </p>
      </GlassPanel>
    </div>
  );
}
