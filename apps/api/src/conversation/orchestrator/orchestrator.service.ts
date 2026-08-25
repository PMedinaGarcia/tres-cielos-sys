import {
  Inject,
  Injectable,
  Logger,
  Optional,
} from "@nestjs/common";
import { toolCatalogDefinitions } from "../../tools-catalog/tool-schemas";
import { ToolsExecutorService } from "../../tools-catalog/tools-executor.service";
import { RegistroConsultaCatalogoService } from "../../tools-catalog/registro-consulta-catalogo.service";
import { LLM_PORT } from "../../ports/tokens";
import type { LlmPort } from "../../ports/llm.port";
import { ScriptService } from "../script/script.service";
import { HandoffService } from "../handoff/handoff.service";
import { SAFE_COPY_K09 } from "../handoff/safe-copy";
import { ConversationStoreService } from "../stubs/conversation-store.service";
import { AuditEventoService } from "../stubs/audit-evento.service";
import { CrmBriefStubService } from "../stubs/crm-brief.stub";
import { QuotaStubService } from "../stubs/quota.stub";
import {
  RAG_PIPELINE_PORT,
  type RagPipelinePort,
} from "../stubs/rag-pipeline.port";
import type {
  CamposCapturados,
  ConversacionState,
  InboundMessage,
  MotivoHandoff,
  RutaOrquestador,
  TurnResponse,
} from "../types";
import { fechaTentativaToIso } from "../script/fecha-tentativa.parser";
import { IntentClassifierService } from "./intent-classifier.service";
import {
  decideRoute,
  isAdjuntoSoportado,
} from "./routing.policies";
import {
  applyNoRecuperablePrecioGate,
  assertNoInventedMontos,
  isIntencionMonetaria,
  stripMontosFromProse,
} from "./no-recuperable-precio.gate";
import { ReasoningTraceService } from "../reasoning/reasoning-trace.service";
import { ExpedientePersistService } from "../../crm/expediente-persist.service";

@Injectable()
export class OrchestratorService {
  private readonly logger = new Logger(OrchestratorService.name);

  constructor(
    private readonly store: ConversationStoreService,
    private readonly script: ScriptService,
    private readonly handoff: HandoffService,
    private readonly intent: IntentClassifierService,
    private readonly tools: ToolsExecutorService,
    private readonly registroCatalogo: RegistroConsultaCatalogoService,
    private readonly audit: AuditEventoService,
    private readonly crm: CrmBriefStubService,
    private readonly quota: QuotaStubService,
    @Inject(LLM_PORT) private readonly llm: LlmPort,
    @Inject(RAG_PIPELINE_PORT) private readonly rag: RagPipelinePort,
    private readonly reasoning: ReasoningTraceService,
    @Optional() private readonly expediente?: ExpedientePersistService,
  ) {}

  async handleTurn(inbound: InboundMessage): Promise<TurnResponse> {
    const conv = await this.store.resolveOrCreate({
      canal: inbound.canal,
      externalThreadId: inbound.externalThreadId,
      perfilNombre: inbound.perfilCanal?.nombre,
      perfilWaId: inbound.perfilCanal?.waId,
    });

    return this.reasoning.runWithTurn(
      { conversacionId: conv.id, turnId: inbound.externalMessageId },
      () => this.executeTurn(conv, inbound),
    );
  }

  private async executeTurn(
    conv: ConversacionState,
    inbound: InboundMessage,
  ): Promise<TurnResponse> {
    // Idempotencia básica por externalMessageId
    const dup = conv.mensajes.find(
      (m) =>
        m.direccion === "entrante" &&
        m.externalMessageId === inbound.externalMessageId,
    );
    if (dup) {
      this.reasoning.append({
        level: "preflight",
        kind: "idempotencia",
        detail: { duplicate: true, externalMessageId: inbound.externalMessageId },
      });
      return this.attachTrace({
        conversacionId: conv.id,
        mensajeSalienteId: null,
        textoRespuesta: "",
        ruta: "silencio",
        estadoBot: conv.estadoBot,
        eventoOperativoId: null,
        registroConsultaCatalogoId: null,
        registroRecuperacionId: null,
        motivoHandoff: conv.motivoHandoff,
        pasoGuion: conv.pasoGuion,
      });
    }

    const msgIn = await this.store.appendMensaje(conv.id, {
      direccion: "entrante",
      autor: "prospecto",
      contenido: inbound.texto ?? "",
      timestamp: inbound.recibidoEn ?? new Date().toISOString(),
      externalMessageId: inbound.externalMessageId,
      consumioCupo: false,
    });

    const adjuntoInvalido = (inbound.adjuntos ?? []).some((a) => {
      const mimeType =
        "mimeType" in a && a.mimeType
          ? a.mimeType
          : "mime" in a
            ? String((a as { mime?: string }).mime ?? "")
            : "";
      return !isAdjuntoSoportado({
        mimeType,
        sizeBytes: a.sizeBytes ?? (a as { bytes?: number }).bytes,
        duracionSec: a.duracionSec,
      });
    });

    const hardQuota = this.quota.isHardLimitIa();
    this.reasoning.append({
      level: "preflight",
      kind: "estado_bot",
      detail: { estadoBot: conv.estadoBot },
    });
    this.reasoning.append({
      level: "preflight",
      kind: "cupo",
      detail: { hardQuota, snapshot: this.quota.snapshot() },
    });

    const intent = await this.intent.classify({
      texto: inbound.texto ?? "",
      pasoGuion: conv.pasoGuion,
    });
    this.reasoning.append({
      level: "intent",
      value: intent,
    });

    const capturaPendiente = this.script.isCapturaPendiente(conv);
    const route = decideRoute({
      estadoBot: conv.estadoBot,
      hardQuota,
      texto: inbound.texto ?? "",
      pasoGuion: conv.pasoGuion,
      capturaPendiente,
      adjuntoInvalido,
      intent,
    });
    this.reasoning.append({
      level: "routing",
      decision: {
        kind: route.kind,
        motivo: "motivo" in route ? route.motivo : undefined,
      },
      inputs: {
        capturaPendiente,
        adjuntoInvalido,
        hardQuota,
        pasoGuion: conv.pasoGuion,
      },
    });

    if (route.kind === "silencio") {
      const ev = await this.audit.emit({
        tipo: "bot_decision",
        conversacionId: conv.id,
        oportunidadId: conv.oportunidadId,
        mensajeId: msgIn.id,
        payload: {
          ruta: "silencio",
          estadoBot: conv.estadoBot,
          cupo: this.quota.snapshot(),
          intent,
          routing: route.kind,
        },
      });
      return this.attachTrace({
        conversacionId: conv.id,
        mensajeSalienteId: null,
        textoRespuesta: "",
        ruta: "silencio",
        estadoBot: conv.estadoBot,
        eventoOperativoId: ev.id,
        registroConsultaCatalogoId: null,
        registroRecuperacionId: null,
        motivoHandoff: conv.motivoHandoff,
        pasoGuion: conv.pasoGuion,
      });
    }

    if (route.kind === "quota_hard" || route.kind === "handoff") {
      const motivo: MotivoHandoff =
        route.kind === "quota_hard" ? "cupo_ia" : route.motivo;
      return this.finishHandoff(conv.id, conv.oportunidadId, motivo, msgIn.id);
    }

    if (route.kind === "guion") {
      return this.runGuion(conv.id, inbound.texto ?? "", msgIn.id);
    }

    if (route.kind === "catalogo") {
      return this.runCatalogo(conv.id, inbound.texto ?? "", msgIn.id);
    }

    if (route.kind === "rag") {
      return this.runRag(conv.id, inbound.texto ?? "", msgIn.id);
    }

    return this.finishSafe(conv.id, conv.oportunidadId, msgIn.id, null);
  }

  private async runGuion(
    conversacionId: string,
    texto: string,
    mensajeEntranteId: string,
  ): Promise<TurnResponse> {
    const conv = (await this.store.findById(conversacionId))!;
    const pasoFrom = conv.pasoGuion;
    const result = await this.script.handleTurn(conv, texto);

    const camposDelta = Object.keys(result.camposCapturados).filter((k) => {
      const key = k as keyof typeof result.camposCapturados;
      return result.camposCapturados[key] !== conv.camposCapturados[key];
    });
    this.reasoning.append({
      level: "guion",
      pasoFrom,
      pasoTo: result.pasoGuion,
      camposDelta,
    });

    await this.store.update(conversacionId, {
      pasoGuion: result.pasoGuion,
      camposCapturados: result.camposCapturados,
      ultimaRuta: "guion",
    });

    const crm = await this.crm.applyAfterTurn({
      ...conv,
      camposCapturados: result.camposCapturados,
      pasoGuion: result.pasoGuion,
    });
    await this.store.update(conversacionId, {
      brief: crm.brief,
      calificado: crm.calificado,
      listoParaCotizar: crm.listoParaCotizar,
    });

    const persisted = await this.store.findById(conversacionId);
    if (persisted) {
      await this.expediente?.persistAfterTurn(persisted);
    }

    return this.finishReply({
      conversacionId,
      oportunidadId: conv.oportunidadId,
      texto: result.textoRespuesta,
      ruta: "guion",
      mensajeEntranteId,
      pasoGuion: result.pasoGuion,
      calificacionResultado: crm.calificado ? "calificado" : "parcial",
      listoParaCotizar: crm.listoParaCotizar,
    });
  }

  private async runCatalogo(
    conversacionId: string,
    texto: string,
    mensajeEntranteId: string,
  ): Promise<TurnResponse> {
    const conv = (await this.store.findById(conversacionId))!;

    const gate = applyNoRecuperablePrecioGate({
      intencionMonetaria: isIntencionMonetaria(texto),
      rama: "tools",
    });
    this.reasoning.append({
      level: "gate_precio",
      action: gate,
      rama: "tools",
    });
    if (gate !== "force_tools" && gate !== "pass" && gate !== "tools_or_handoff") {
      // no-op: datos_duros siempre tools
    }

    let completion;
    try {
      completion = await this.llm.completeWithTools({
        messages: [
          {
            role: "system",
            content: catalogSystemPrompt(conv.camposCapturados),
          },
          { role: "user", content: texto },
        ],
        tools: toolCatalogDefinitions(),
      });
    } catch (err) {
      this.logger.warn(`LLM tools failed: ${String(err)}`);
      return this.finishHandoff(
        conversacionId,
        conv.oportunidadId,
        "proveedor_ia",
        mensajeEntranteId,
      );
    }

    const tokens =
      (completion.usage?.promptTokens ?? 0) +
      (completion.usage?.completionTokens ?? 0);
    this.quota.consumeIaTokens(tokens);

    const toolCalls = completion.toolCalls ?? [];
    if (toolCalls.length === 0) {
      return this.finishHandoff(
        conversacionId,
        conv.oportunidadId,
        "sin_catalogo",
        mensajeEntranteId,
      );
    }

    const toolPayloads: Array<Record<string, unknown>> = [];
    let registroId: string | null = null;
    let paqueteId: string | null = conv.paqueteTentativoId;
    let precioSnapshot: Record<string, unknown> | null = null;
    const montosPermitidos: Array<number | string> = [];
    const redactionParts: string[] = [];

    for (const call of toolCalls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.argumentsJson || "{}") as Record<
          string,
          unknown
        >;
      } catch {
        args = {};
      }

      args = mergeCatalogToolArgs(call.name, args, conv.camposCapturados);

      const exec = await this.tools.execute({
        name: call.name,
        arguments: args,
      });

      const registro = await this.registroCatalogo.create({
        conversacionId,
        mensajeId: mensajeEntranteId,
        tool: call.name,
        input: args,
        output: exec.result,
        ok: exec.ok,
        filasSku: exec.filasSku,
        latenciaMs: exec.latenciaMs,
      });
      registroId = registro.id;

      toolPayloads.push({
        nombre: exec.name,
        latenciaMs: exec.latenciaMs,
        ok: exec.ok,
        filasSku: exec.filasSku,
        errorCode: exec.errorCode,
      });

      if (exec.transferir) {
        this.emitCatalogTools(toolPayloads);
        return this.finishHandoff(
          conversacionId,
          conv.oportunidadId,
          (exec.transferir.motivo as MotivoHandoff) || "solicitud_usuario",
          mensajeEntranteId,
          registroId,
        );
      }

      if (!exec.ok || exec.errorCode === "sin_paquete" || exec.errorCode === "sin_precio_vigente") {
        this.emitCatalogTools(toolPayloads);
        return this.finishHandoff(
          conversacionId,
          conv.oportunidadId,
          "sin_catalogo",
          mensajeEntranteId,
          registroId,
        );
      }

      const redacted = redactToolResult(exec.name, exec.result);
      redactionParts.push(redacted.texto);
      montosPermitidos.push(...redacted.montos);
      if (redacted.paqueteId) paqueteId = redacted.paqueteId;
      if (redacted.precioSnapshot) precioSnapshot = redacted.precioSnapshot;
    }

    let textoRespuesta = redactionParts.join("\n");
    const check = assertNoInventedMontos({
      respuesta: textoRespuesta,
      montosPermitidos,
    });
    if (!check.ok) {
      this.logger.error(
        `Anti-hallucination: montos no permitidos ${check.montosSospechosos.join(",")}`,
      );
      textoRespuesta = stripMontosFromProse(textoRespuesta);
      this.emitCatalogTools(toolPayloads, "strip_handoff");
      return this.finishHandoff(
        conversacionId,
        conv.oportunidadId,
        "sin_catalogo",
        mensajeEntranteId,
        registroId,
      );
    }

    await this.store.update(conversacionId, {
      paqueteTentativoId: paqueteId,
      ultimaRuta: "catalogo",
    });

    const refreshed = (await this.store.findById(conversacionId))!;
    const crm = await this.crm.applyAfterTurn(refreshed, {
      paqueteTentativoId: paqueteId,
      precioSnapshot,
      registroConsultaCatalogoId: registroId,
    });
    await this.store.update(conversacionId, {
      brief: crm.brief,
      calificado: crm.calificado,
      listoParaCotizar: crm.listoParaCotizar,
    });

    this.emitCatalogTools(toolPayloads, "pass");

    return this.finishReply({
      conversacionId,
      oportunidadId: conv.oportunidadId,
      texto: textoRespuesta,
      ruta: "catalogo",
      mensajeEntranteId,
      pasoGuion: conv.pasoGuion,
      tools: toolPayloads,
      registroConsultaCatalogoId: registroId,
      calificacionResultado: crm.calificado ? "calificado" : "parcial",
      listoParaCotizar: crm.listoParaCotizar,
    });
  }

  private async runRag(
    conversacionId: string,
    texto: string,
    mensajeEntranteId: string,
  ): Promise<TurnResponse> {
    const conv = (await this.store.findById(conversacionId))!;

    if (isIntencionMonetaria(texto)) {
      this.reasoning.append({
        level: "gate_precio",
        action: "force_tools",
        rama: "rag",
        detail: { motivo: "intencion_monetaria" },
      });
      return this.runCatalogo(conversacionId, texto, mensajeEntranteId);
    }

    const result = await this.rag.answer({
      query: texto,
      conversacionId,
      mensajeId: mensajeEntranteId,
      sedeId: conv.camposCapturados.sedeId,
    });

    if (result.redirigirTools) {
      this.reasoning.append({
        level: "gate_precio",
        action: "force_tools",
        rama: "rag",
        detail: { registroRecuperacionId: result.registroRecuperacionId },
      });
      return this.runCatalogo(conversacionId, texto, mensajeEntranteId);
    }

    this.reasoning.append({
      level: "rag",
      scoresRerank: result.scoresRerank ?? [],
      umbral: result.umbral ?? 0.85,
      fragmentoIds: result.fragmentoIds ?? [],
      cita: result.cita ?? null,
      registroRecuperacionId: result.registroRecuperacionId,
      motivoHandoff: result.ok ? null : (result.motivoFallo ?? null),
    });

    if (!result.ok) {
      const motivo: MotivoHandoff =
        result.motivoFallo === "rerank_bajo"
          ? "rerank_bajo"
          : result.motivoFallo === "sin_cita_rag"
            ? "sin_cita_rag"
            : result.motivoFallo === "proveedor_ia"
              ? "proveedor_ia"
              : "otro";
      return this.finishHandoff(
        conversacionId,
        conv.oportunidadId,
        motivo,
        mensajeEntranteId,
        null,
        result.registroRecuperacionId ?? null,
      );
    }

    let textoRespuesta = result.texto ?? SAFE_COPY_K09;
    const gate = applyNoRecuperablePrecioGate({
      intencionMonetaria: false,
      rama: "rag",
      fragmentos: (result.fragmentoIds ?? []).map((id) => ({
        id,
        noRecuperablePrecio: true,
      })),
    });
    this.reasoning.append({
      level: "gate_precio",
      action: gate,
      rama: "rag",
    });
    if (gate === "rag_prose_sin_montos") {
      textoRespuesta = stripMontosFromProse(textoRespuesta);
    }

    return this.finishReply({
      conversacionId,
      oportunidadId: conv.oportunidadId,
      texto: textoRespuesta,
      ruta: "rag",
      mensajeEntranteId,
      pasoGuion: conv.pasoGuion,
      rag: {
        scoresRerank: result.scoresRerank ?? [],
        umbral: result.umbral ?? 0.85,
        fragmentoIds: result.fragmentoIds ?? [],
        cita: result.cita ?? null,
      },
      registroRecuperacionId: result.registroRecuperacionId ?? null,
    });
  }

  private async finishHandoff(
    conversacionId: string,
    oportunidadId: string,
    motivo: MotivoHandoff,
    mensajeEntranteId: string,
    registroConsultaCatalogoId: string | null = null,
    registroRecuperacionId: string | null = null,
  ): Promise<TurnResponse> {
    this.reasoning.append({
      level: "handoff",
      motivo,
    });
    const hand = await this.handoff.escalate({
      conversacionId,
      motivo,
      oportunidadId,
      mensajeId: mensajeEntranteId,
    });

    return this.finishReply({
      conversacionId,
      oportunidadId,
      texto: hand.safeCopy,
      ruta: "handoff",
      mensajeEntranteId,
      motivoHandoff: motivo,
      registroConsultaCatalogoId,
      registroRecuperacionId,
      estadoBot: "escalado",
    });
  }

  private async finishSafe(
    conversacionId: string,
    oportunidadId: string,
    mensajeEntranteId: string,
    motivo: MotivoHandoff | null,
  ): Promise<TurnResponse> {
    await this.store.update(conversacionId, { ultimaRuta: "safe" });
    return this.finishReply({
      conversacionId,
      oportunidadId,
      texto: SAFE_COPY_K09,
      ruta: "safe",
      mensajeEntranteId,
      motivoHandoff: motivo,
    });
  }

  private async finishReply(input: {
    conversacionId: string;
    oportunidadId: string;
    texto: string;
    ruta: RutaOrquestador;
    mensajeEntranteId: string;
    pasoGuion?: TurnResponse["pasoGuion"];
    motivoHandoff?: MotivoHandoff | null;
    tools?: Array<Record<string, unknown>>;
    rag?: Record<string, unknown>;
    registroConsultaCatalogoId?: string | null;
    registroRecuperacionId?: string | null;
    calificacionResultado?: string;
    listoParaCotizar?: boolean;
    estadoBot?: TurnResponse["estadoBot"];
  }): Promise<TurnResponse> {
    this.quota.consumeMessaging(1);
    const msgOut = await this.store.appendMensaje(input.conversacionId, {
      direccion: "saliente",
      autor: "bot",
      contenido: input.texto,
      timestamp: new Date().toISOString(),
      ruta: input.ruta,
      consumioCupo: true,
    });

    const conv = (await this.store.findById(input.conversacionId))!;
    if (input.ruta !== "handoff") {
      await this.store.update(input.conversacionId, {
        ultimaRuta: input.ruta,
      });
    }

    const evento = await this.audit.emit({
      tipo: "bot_mensaje_saliente",
      conversacionId: input.conversacionId,
      oportunidadId: input.oportunidadId,
      mensajeId: msgOut.id,
      payload: {
        ruta: input.ruta,
        pasoGuion: input.pasoGuion ?? conv.pasoGuion,
        tools: input.tools ?? [],
        rag: input.rag ?? null,
        cupo: this.quota.snapshot(),
        motivoHandoff: input.motivoHandoff ?? null,
        calificacionResultado: input.calificacionResultado ?? null,
        listoParaCotizar: input.listoParaCotizar ?? null,
        registroConsultaCatalogoId: input.registroConsultaCatalogoId ?? null,
        registroRecuperacionId: input.registroRecuperacionId ?? null,
        mensajeEntranteId: input.mensajeEntranteId,
      },
    });

    return this.attachTrace({
      conversacionId: input.conversacionId,
      mensajeSalienteId: msgOut.id,
      textoRespuesta: input.texto,
      ruta: input.ruta,
      estadoBot: input.estadoBot ?? conv.estadoBot,
      eventoOperativoId: evento.id,
      registroConsultaCatalogoId: input.registroConsultaCatalogoId ?? null,
      registroRecuperacionId: input.registroRecuperacionId ?? null,
      motivoHandoff: input.motivoHandoff ?? null,
      pasoGuion: input.pasoGuion ?? conv.pasoGuion,
    });
  }

  private emitCatalogTools(
    toolPayloads: Array<Record<string, unknown>>,
    antiHallucination?: "pass" | "strip_handoff",
  ): void {
    this.reasoning.append({
      level: "catalog_tools",
      tools: toolPayloads.map((t) => ({
        nombre: String(t.nombre ?? ""),
        ok: Boolean(t.ok),
        filasSku: Array.isArray(t.filasSku)
          ? (t.filasSku as string[])
          : [],
        errorCode:
          typeof t.errorCode === "string" ? t.errorCode : undefined,
      })),
      antiHallucination,
    });
  }

  private attachTrace(res: TurnResponse): TurnResponse {
    const finished = this.reasoning.finish({
      ruta: res.ruta,
      estadoBot: res.estadoBot,
      motivoHandoff: res.motivoHandoff,
      eventoOperativoId: res.eventoOperativoId,
      registroConsultaCatalogoId: res.registroConsultaCatalogoId,
      registroRecuperacionId: res.registroRecuperacionId ?? null,
    });
    return {
      ...res,
      reasoningTraceId: finished?.id ?? this.reasoning.currentId() ?? null,
      reasoningTrace: finished ?? this.reasoning.current() ?? null,
    };
  }
}

function catalogSystemPrompt(campos: CamposCapturados): string {
  const ctx = {
    tipoEvento: campos.tipoEvento ?? null,
    aforo: campos.aforo ?? null,
    fechaTentativa: campos.fechaTentativa ?? null,
    sede: campos.sedeNombre ?? null,
  };
  return [
    "Eres el planner de tools del catálogo Tres Cielos.",
    "Solo puedes usar las tools listadas. Nunca inventes precios. Montos únicamente de tool results.",
    "El usuario puede escribir con faltas de ortografía; interpreta la intención.",
    "Si mencionan un paquete por nombre informal (esencial, premium), usa buscar_paquetes u obtener_precio_paquete.",
    `Contexto ya capturado del lead: ${JSON.stringify(ctx)}`,
    "Si hay fechaTentativa, pásala como fecha ISO (YYYY-MM-DD) a buscar_paquetes y obtener_precio_paquete.",
  ].join(" ");
}

function mergeCatalogToolArgs(
  name: string,
  args: Record<string, unknown>,
  campos: CamposCapturados,
): Record<string, unknown> {
  const fecha = fechaTentativaToIso(campos.fechaTentativa);
  const next = { ...args };
  if (name === "buscar_paquetes") {
    if (!next.tipoEvento && campos.tipoEvento) next.tipoEvento = campos.tipoEvento;
    if (next.aforo == null && campos.aforo != null) next.aforo = campos.aforo;
    if (!next.sede && campos.sedeNombre) next.sede = campos.sedeNombre;
    if (!next.fecha && fecha) next.fecha = fecha;
  }
  if (
    (name === "obtener_precio_paquete" || name === "comparar_paquetes") &&
    !next.fecha &&
    fecha
  ) {
    next.fecha = fecha;
  }
  return next;
}

function redactToolResult(
  toolName: string,
  result: unknown,
): {
  texto: string;
  montos: Array<number | string>;
  paqueteId: string | null;
  precioSnapshot: Record<string, unknown> | null;
} {
  const montos: Array<number | string> = [];
  let paqueteId: string | null = null;
  let precioSnapshot: Record<string, unknown> | null = null;

  if (!result || typeof result !== "object") {
    return { texto: "Sin datos de catálogo.", montos, paqueteId, precioSnapshot };
  }

  const r = result as Record<string, unknown>;

  if (toolName === "obtener_precio_paquete" && typeof r.monto === "number") {
    montos.push(r.monto);
    paqueteId = typeof r.paqueteId === "string" ? r.paqueteId : null;
    precioSnapshot = {
      moneda: r.moneda,
      monto: r.monto,
      rangoMin: r.rangoMin,
      rangoMax: r.rangoMax,
      unidad: r.unidad,
      vigenteDesde: r.vigenteDesde,
      vigenteHasta: r.vigenteHasta,
    };
    return {
      texto: `El paquete ${r.sku} (${r.nombre}) tiene precio vigente de ${r.moneda} ${r.monto} por ${r.unidad}.`,
      montos,
      paqueteId,
      precioSnapshot,
    };
  }

  if (toolName === "buscar_paquetes" && Array.isArray(result)) {
    const lines = (result as Array<Record<string, unknown>>).map((p) => {
      const muestra = p.precioMuestra as { monto?: number; moneda?: string } | null;
      if (muestra?.monto != null) montos.push(muestra.monto);
      return `- ${p.sku}: ${p.nombre} (aforo ${p.aforoMin}-${p.aforoMax})${
        muestra?.monto != null ? ` · desde ${muestra.moneda} ${muestra.monto}` : ""
      }`;
    });
    return {
      texto:
        lines.length > 0
          ? `Encontré estos paquetes publicados:\n${lines.join("\n")}`
          : "No hay paquetes publicados que coincidan con esos filtros.",
      montos,
      paqueteId,
      precioSnapshot,
    };
  }

  if (toolName === "listar_inclusiones") {
    paqueteId = typeof r.paqueteId === "string" ? r.paqueteId : null;
    const inclusiones = (r.inclusiones as Array<{ nombre: string }>) ?? [];
    return {
      texto: `Inclusiones de ${r.sku}: ${inclusiones.map((i) => i.nombre).join(", ") || "sin listado"}.`,
      montos,
      paqueteId,
      precioSnapshot,
    };
  }

  if (toolName === "comparar_paquetes") {
    const items = (r.items as Array<Record<string, unknown>>) ?? [];
    const lines = items.map((i) => {
      const precio = i.precio as { monto?: number; moneda?: string } | null;
      if (precio?.monto != null) montos.push(precio.monto);
      return `- ${i.sku}: ${i.nombre}${
        precio?.monto != null ? ` · ${precio.moneda} ${precio.monto}` : " · sin precio vigente"
      }`;
    });
    return {
      texto: `Comparación:\n${lines.join("\n")}`,
      montos,
      paqueteId,
      precioSnapshot,
    };
  }

  if (toolName === "evaluar_reglas_paquete") {
    paqueteId = typeof r.paqueteId === "string" ? r.paqueteId : null;
    const reglas = (r.reglas as Array<{ tipo: string; mensajeProspecto?: string }>) ?? [];
    return {
      texto: `Reglas de ${r.sku}: ${
        reglas.map((x) => x.mensajeProspecto || x.tipo).join("; ") || "sin reglas"
      }.`,
      montos,
      paqueteId,
      precioSnapshot,
    };
  }

  return {
    texto: JSON.stringify(result),
    montos,
    paqueteId,
    precioSnapshot,
  };
}

/** Re-export tipado del fake catalog-aware (tests). */
export { CatalogAwareLlmPort } from "../stubs/catalog-aware-llm.port";
