# Corpus ingestible de negocio

Fuente **máquina** del conocimiento comercial Tres Cielos. Complementa la guía humana en [`docs/negocio/00-indice.md`](../../docs/negocio/00-indice.md).

**No** sustituye [`fixtures/catalog/golden-snapshot.json`](../catalog/golden-snapshot.json) ni [`apps/api/src/rag/fixtures/knowledge-fixtures.ts`](../../apps/api/src/rag/fixtures/knowledge-fixtures.ts). Esos fixtures siguen siendo el sandbox de tests.

## Layout

```
fixtures/negocio/
  README.md                          ← este archivo
  schema/documento.frontmatter.md    ← contrato YAML
  manifest.yaml                      ← única lista publicable
  evergreen/                         ← políticas y FAQ de cambio lento
  ediciones/2026-07/
    _edicion.yaml
    lineas/                          ← K05 (composición)
    modulos/                         ← K11 (atómicos)
    cortesias/                       ← K12
    sede/                            ← K02 evidencia (borrador)
    catalog/                         ← datos duros (YAML)
```

## Cómo publicar (contrato)

1. Un job futuro recorre **solo** `manifest.yaml`.
2. Incluye entradas con `estado: publicado` cuya ventana cubre `fecha_evento` o `now`.
3. Markdown K con `sin_montos: true` → `DocumentoFuente` / RAG.
4. `catalog/*.yaml` → import Prisma (cuando las tarifas dejen de ser `borrador`).
5. Nueva temporada: copiar `ediciones/2026-07/` → `ediciones/AAAA-MM/`, actualizar `_edicion.yaml` y el manifest; archivar la edición anterior.

## Anti-alucinación

- Cifras de paquete bodas 2027 viven en `catalog/precios.yaml` (`publicado`). El placeholder `2280` está archivado.
- Renta sigue en `borrador`.
- Presupuestos florales y umbrales de hospedaje: solo `catalog/`.
- Excel originales de cotización **no** se copian al repo.
