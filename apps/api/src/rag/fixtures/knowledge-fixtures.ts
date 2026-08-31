import { hashToEmbedding } from "../../ports/__fakes__/hash";
import { FragmentoRecuperable } from "../types";
import { SEDE_ID } from "@tres-cielos/shared";

const EMBED_DIM = 1536;

/**
 * Fixtures mínimos K01/K02/K08/K09 para tests Fase D.
 * Contenido narrativo autorizado — sin montos cotizables.
 */
export function buildKnowledgeFixtures(): FragmentoRecuperable[] {
  return [
    frag({
      id: "frag-k01-horarios",
      inventarioId: "K01",
      nombreArchivoCita: "K01-faq-general.pdf",
      tipoMaterial: "faq",
      sedeId: null,
      texto:
        "Tres Cielos es un jardín para eventos sociales. Las visitas al venue las agenda un asesor; no hay horario de visita publicado en este canal.",
    }),
    frag({
      id: "frag-k01-ubicacion",
      inventarioId: "K01",
      nombreArchivoCita: "K01-faq-general.pdf",
      tipoMaterial: "faq",
      sedeId: null,
      texto:
        "La sede operativa de Tres Cielos es Tres Cielos Tequesquitengo. Dirección: Lago de Teques Lote 36, 4ª sección, CP 62915, Tequesquitengo, Jojutla, Morelos. Referencia vial: Bajada 6 hasta el fondo. El jardín está a orilla del lago de Tequesquitengo, a unos 90 minutos de la Ciudad de México.",
    }),
    frag({
      id: "frag-k02-ficha",
      inventarioId: "K02",
      nombreArchivoCita: "K02-ficha-tequesquitengo.docx",
      tipoMaterial: "word",
      sedeId: SEDE_ID,
      texto:
        "Tres Cielos Tequesquitengo es la sede activa de Tres Cielos. Dirección: Lago de Teques Lote 36, 4ª sección, CP 62915, Tequesquitengo, Jojutla, Morelos. Venue tipo jardín: estacionamiento, baños y áreas comunes; capilla techada y consagrada; carpa fija de unos 600 m² en paquetes de bodas; explanada; pista de baile de seis por seis metros; suite nupcial en el predio.",
    }),
    frag({
      id: "frag-k02-horario-visitas",
      inventarioId: "K02",
      nombreArchivoCita: "K02-ficha-tequesquitengo.docx",
      tipoMaterial: "word",
      sedeId: SEDE_ID,
      texto:
        "Las visitas a Tres Cielos Tequesquitengo las agenda un asesor. No hay horario de visita publicado en este canal.",
    }),
    frag({
      id: "frag-k02-como-llegar",
      inventarioId: "K02",
      nombreArchivoCita: "K02-ficha-tequesquitengo.docx",
      tipoMaterial: "word",
      sedeId: SEDE_ID,
      texto:
        "Cómo llegar a Tres Cielos Tequesquitengo: Bajada 6 hasta el fondo. El jardín está a orilla del lago de Tequesquitengo, a unos 90 minutos de la Ciudad de México. La prueba de menú se realiza en Cuernavaca; eso no es la dirección del jardín. La oficina de informes en CDMX no es la locación del evento.",
    }),
    frag({
      id: "frag-k08-limites",
      inventarioId: "K08",
      nombreArchivoCita: "K08-limites-bot.pdf",
      tipoMaterial: "faq",
      sedeId: null,
      texto:
        "El asistente virtual no negocia descuentos, no confirma disponibilidad de fechas concretas ni emite contratos. Si necesitas algo fuera de FAQ y catálogo, se escala a un asesor humano.",
    }),
    frag({
      id: "frag-k09-safe",
      inventarioId: "K09",
      nombreArchivoCita: "K09-plantillas-safe.pdf",
      tipoMaterial: "faq",
      sedeId: null,
      texto:
        "Plantilla safe: No tengo esa información en mi base de conocimiento autorizada. Te conecto con un asesor para ayudarte con precisión.",
    }),
    frag({
      id: "frag-tarifa-ocr",
      inventarioId: "K01",
      nombreArchivoCita: "tarjeta-precios.jpg",
      tipoMaterial: "foto",
      origenDerivacion: "vision",
      sedeId: null,
      noRecuperablePrecio: true,
      texto:
        "Imagen de cartel con tarifas del venue. Había una tabla de precios en la foto; el detalle numérico no es recuperable por este canal. Consulta paquetes con un asesor o el catálogo.",
    }),
    frag({
      id: "frag-borrador",
      inventarioId: "K01",
      nombreArchivoCita: "borrador.pdf",
      tipoMaterial: "pdf",
      sedeId: null,
      documentoEstado: "borrador",
      texto: "Borrador no publicado: horario secreto 9:00.",
    }),
    frag({
      id: "frag-pipeline-pendiente",
      inventarioId: "K01",
      nombreArchivoCita: "pendiente.pdf",
      tipoMaterial: "pdf",
      sedeId: null,
      pipelineEstado: "procesando",
      texto: "Documento aún en pipeline; no debe recuperarse.",
    }),
    frag({
      id: "frag-inactivo",
      inventarioId: "K02",
      nombreArchivoCita: "version-vieja.docx",
      tipoMaterial: "word",
      sedeId: SEDE_ID,
      activo: false,
      texto: "Versión archivada de horario antiguo 10:00 a 17:00.",
    }),
  ];
}

export const FIXTURE_SEDE_TEQUESQUITENGO = SEDE_ID;

function frag(
  partial: Partial<FragmentoRecuperable> &
    Pick<
      FragmentoRecuperable,
      "id" | "texto" | "nombreArchivoCita" | "tipoMaterial"
    >,
): FragmentoRecuperable {
  const texto = partial.texto;
  return {
    id: partial.id,
    texto,
    embedding: hashToEmbedding(texto, EMBED_DIM),
    activo: partial.activo ?? true,
    documentoEstado: partial.documentoEstado ?? "publicado",
    pipelineEstado: partial.pipelineEstado ?? "listo",
    sedeId: partial.sedeId === undefined ? null : partial.sedeId,
    tipoMaterial: partial.tipoMaterial,
    origenDerivacion: partial.origenDerivacion ?? "texto_nativo",
    noRecuperablePrecio: partial.noRecuperablePrecio ?? false,
    nombreArchivoCita: partial.nombreArchivoCita,
    inventarioId: partial.inventarioId,
  };
}
