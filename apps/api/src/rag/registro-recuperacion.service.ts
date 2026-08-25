import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import {
  CandidatoRegistro,
  FragmentoFinalRegistro,
  MotivoHandoffRag,
  OrigenDerivacion,
  RegistroRecuperacion,
  RerankedCandidate,
  TipoMaterial,
} from "./types";

export interface CreateRegistroInput {
  queryOriginal: string;
  queryRewrite?: string | null;
  umbral: number;
  conversacionId?: string;
  mensajeId?: string;
  ranked: RerankedCandidate[];
  finales: RerankedCandidate[];
  respuestaTexto?: string | null;
  cita?: string | null;
  motivoHandoff?: MotivoHandoffRag | null;
  handoffPorBajaConfianza?: boolean;
  flags?: Partial<RegistroRecuperacion["flags"]>;
}

/**
 * D4 — Persistencia in-memory de RegistroRecuperacion (auditoría RAG).
 * Cuando exista Prisma, este servicio escribirá la entidad real.
 */
@Injectable()
export class RegistroRecuperacionService {
  private readonly store = new Map<string, RegistroRecuperacion>();

  create(input: CreateRegistroInput): RegistroRecuperacion {
    const candidatos: CandidatoRegistro[] = input.ranked.map((c) => ({
      fragmentoId: c.fragmento.id,
      scoreHybrid: c.scoreHybrid,
      origenRama: c.origenRama,
      scoreRerank: c.scoreRerank,
      tipoMaterial: c.fragmento.tipoMaterial,
      origenDerivacion: c.fragmento.origenDerivacion,
      noRecuperablePrecio: c.fragmento.noRecuperablePrecio,
    }));

    const fragmentosFinales: FragmentoFinalRegistro[] = input.finales.map(
      (c) => ({
        fragmentoId: c.fragmento.id,
        scoreRerank: c.scoreRerank,
        tipoMaterial: c.fragmento.tipoMaterial,
        origenDerivacion: c.fragmento.origenDerivacion,
        nombreArchivoCita: c.fragmento.nombreArchivoCita,
        noRecuperablePrecio: c.fragmento.noRecuperablePrecio,
      }),
    );

    const top = input.finales[0];
    const tipoMaterial: TipoMaterial | null = top?.fragmento.tipoMaterial ?? null;
    const origenDerivacion: OrigenDerivacion | null =
      top?.fragmento.origenDerivacion ?? null;

    const fuentesCita = [
      ...new Set(input.finales.map((f) => f.fragmento.nombreArchivoCita)),
    ];

    const handoffPorUmbral =
      input.motivoHandoff === "rerank_bajo" ||
      input.handoffPorBajaConfianza === true;

    const registro: RegistroRecuperacion = {
      id: randomUUID(),
      mensajeId: input.mensajeId,
      conversacionId: input.conversacionId,
      queryOriginal: input.queryOriginal,
      queryRewrite: input.queryRewrite ?? null,
      umbral: input.umbral,
      handoffPorBajaConfianza: input.handoffPorBajaConfianza ?? handoffPorUmbral,
      handoffPorUmbral,
      motivoHandoff: input.motivoHandoff ?? null,
      candidatos,
      fragmentosFinales,
      tipoMaterial,
      origenDerivacion,
      fuentesCita,
      respuestaTexto: input.respuestaTexto ?? null,
      cita: input.cita ?? null,
      flags: {
        algunNoRecuperablePrecio: input.ranked.some(
          (c) => c.fragmento.noRecuperablePrecio,
        ),
        intencionMonetariaBloqueada: false,
        proveedorFallido: false,
        sinCita: false,
        ...input.flags,
      },
      timestamp: new Date().toISOString(),
    };

    this.store.set(registro.id, registro);
    return registro;
  }

  findById(id: string): RegistroRecuperacion | undefined {
    return this.store.get(id);
  }

  clear(): void {
    this.store.clear();
  }
}
