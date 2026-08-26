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
        "Los horarios comerciales de visitas al venue Tres Cielos son de martes a sábado de 11:00 a 18:00. Domingos solo con cita previa. Somos un jardín para eventos sociales.",
    }),
    frag({
      id: "frag-k01-ubicacion",
      inventarioId: "K01",
      nombreArchivoCita: "K01-faq-general.pdf",
      tipoMaterial: "faq",
      sedeId: null,
      texto:
        "Tres Cielos es un venue tipo jardín. Cómo llegar a alto nivel: acceso por avenida principal del polo de eventos; el detalle de ubicación se confirma con el asesor al agendar visita.",
    }),
    frag({
      id: "frag-k02-ficha",
      inventarioId: "K02",
      nombreArchivoCita: "K02-ficha-tequesquitengo.docx",
      tipoMaterial: "word",
      sedeId: SEDE_ID,
      texto:
        "Tres Cielos Tequesquitengo es la sede activa de Tres Cielos. Capacidad orientativa hasta 300 invitados en formato jardín. Cuenta con áreas outdoor e indoor ligero. Restricción: no se permite pirotecnia.",
    }),
    frag({
      id: "frag-k02-horario-visitas",
      inventarioId: "K02",
      nombreArchivoCita: "K02-ficha-tequesquitengo.docx",
      tipoMaterial: "word",
      sedeId: SEDE_ID,
      texto:
        "Horario de visitas de Tres Cielos Tequesquitengo: martes a sábado 11:00 a 18:00. Para domingos se requiere agendar con anticipación.",
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
