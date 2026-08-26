import {
  Inject,
  Injectable,
  Logger,
  Optional,
} from "@nestjs/common";
import { toolCatalogDefinitions } from "../../tools-catalog/tool-schemas";
import { ToolsExecutorService } from "../../tools-catalog/tools-executor.service";
import { RegistroConsultaCatalogoService } from "../../tools-catalog/registro-consulta-catalogo.service";
import { LLM_PORT, OBJECT_STORAGE_PORT } from "../../ports/tokens";
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
import { composeCommercialFaq, COPY_VISITA } from "./commercial-faq.copy";
import { matchCommercialFaqTopic } from "./commercial-faq.matcher";
import { isIntencionVisita } from "./visit-intent";
import {
  applyNoRecuperablePrecioGate,
  assertNoInventedMontos,
  isIntencionMonetaria,
  stripMontosFromProse,
} from "./no-recuperable-precio.gate";
import {
  redactBuscarPaquetes,
  redactBusquedaVacia,
  redactCompararPaquetes,
  redactInclusiones,
  redactPrecioPaquete,
  redactReglas,
  redactSinPrecioVigente,
  redactSinTramoExacto,
} from "./catalog-copy";
import { ReasoningTraceService } from "../reasoning/reasoning-trace.service";
import { ExpedientePersistService } from "../../crm/expediente-persist.service";
import { attachWaContent } from "../../channels/wa-content.composer";
import { paqueteBodas2027Document } from "../../channels/guion-assets";
import {
  canonicalizeSku,
  GUION_ADJUNTO_PAQUETE_BODAS,
  GUION_PDF_FILENAME,
  SEDE_SLUG,
  sedeToCatalogSlug,
} from "@tres-cielos/shared";
import { ConfigService } from "@nestjs/config";
import type { ObjectStoragePort } from "../../ports/object-storage.port";
import {
  GUION_SIGNED_URL_TTL_SEC,
  STORAGE_KEYS,
} from "../../ports/storage-prefixes";
import { isObjectStorageLive } from "../../config/ai-mode";
import { normalizeTipoEventoArg } from "../../tools-catalog/catalog-search.util";

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
    @Optional() private readonly config?: ConfigService,
    @Optional() @Inject(OBJECT_STORAGE_PORT)
    private readonly storage?: ObjectStoragePort,
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
      return await this.attachTrace({
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
      adjuntos: inbound.adjuntos?.map((a) => ({
        mimeType:
          "mimeType" in a && a.mimeType
            ? a.mimeType
            : "mime" in a
              ? String((a as { mime?: string }).mime ?? "")
              : "",
        sizeBytes: a.sizeBytes ?? (a as { bytes?: number }).bytes,
        duracionSec: a.duracionSec,
        storageKey: a.storageKey,
        nombreOriginal:
          "nombreOriginal" in a
            ? String((a as { nombreOriginal?: string }).nombreOriginal ?? "")
            : undefined,
      })),
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
      buttonPayload: inbound.buttonPayload,
    });
    this.reasoning.append({
      level: "intent",
      value: intent,
    });

    const capturaPendiente = this.script.isCapturaPendiente(conv);
    if (isIntencionVisita(inbound.texto ?? "")) {
      conv.camposCapturados = {
        ...conv.camposCapturados,
        intencionVisita: true,
      };
      await this.store.update(conv.id, {
        camposCapturados: conv.camposCapturados,
      });
    }
    const route = decideRoute({
      estadoBot: conv.estadoBot,
      hardQuota,
      texto: inbound.texto ?? "",
      pasoGuion: conv.pasoGuion,
      capturaPendiente,
      adjuntoInvalido,
      intent,
      buttonPayload: inbound.buttonPayload,
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
      const persisted = await this.store.findById(conv.id);
      if (persisted) {
        await this.expediente?.persistAfterTurn(persisted);
      }
      return await this.attachTrace({
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

    if (route.kind === "faq_comercial") {
      return this.runFaqComercial(conv.id, inbound.texto ?? "", msgIn.id);
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

    return this.finishReply({
      conversacionId,
      oportunidadId: conv.oportunidadId,
      texto: result.textoRespuesta,
      ruta: "guion",
      mensajeEntranteId,
      pasoGuion: result.pasoGuion,
      calificacionResultado: crm.calificado ? "calificado" : "parcial",
      listoParaCotizar: crm.listoParaCotizar,
      adjuntoGuion: result.adjuntoGuion,
    });
  }

  private async runFaqComercial(
    conversacionId: string,
    texto: string,
    mensajeEntranteId: string,
  ): Promise<TurnResponse> {
    const conv = (await this.store.findById(conversacionId))!;
    const visita = isIntencionVisita(texto);
    const topic = visita ? null : matchCommercialFaqTopic(texto);
    const body = visita
      ? COPY_VISITA
      : topic && topic !== "fecha_minima"
        ? composeCommercialFaq(topic)
        : composeCommercialFaq("overview");
    this.reasoning.append({
      level: "catalog_tools",
      tools: [
        {
          nombre: "faq_comercial",
          ok: true,
          filasSku: [visita ? "visita" : topic && topic !== "fecha_minima" ? topic : "overview"],
        },
      ],
    });
    await this.store.update(conversacionId, { ultimaRuta: "catalogo" });
    return this.finishReply({
      conversacionId,
      oportunidadId: conv.oportunidadId,
      texto: body,
      ruta: "catalogo",
      mensajeEntranteId,
      pasoGuion: conv.pasoGuion,
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

      if (exec.errorCode === "sin_precio_vigente") {
        const honest = redactSinPrecioVigente(exec.result);
        redactionParts.push(honest.texto);
        continue;
      }

      if (exec.errorCode === "sin_tramo_exacto") {
        const honest = redactSinTramoExacto(exec.result);
        redactionParts.push(honest.texto);
        continue;
      }

      if (!exec.ok || exec.errorCode === "sin_paquete") {
        this.emitCatalogTools(toolPayloads);
        return this.finishHandoff(
          conversacionId,
          conv.oportunidadId,
          "sin_catalogo",
          mensajeEntranteId,
          registroId,
        );
      }

      if (
        exec.name === "buscar_paquetes" &&
        Array.isArray(exec.result) &&
        exec.result.length === 0
      ) {
        const diag = await this.tools.sugerirCercanos({
          tipoEvento: String(args.tipoEvento ?? conv.camposCapturados.tipoEvento ?? "boda"),
          aforo: args.aforo != null ? Number(args.aforo) : undefined,
          sede: args.sede != null ? String(args.sede) : undefined,
          fecha: args.fecha != null ? String(args.fecha) : undefined,
        });
        toolPayloads.push({
          nombre: "sugerir_paquetes_cercanos",
          latenciaMs: 0,
          ok: true,
          filasSku: diag.cercanos
            .map((c) => c.sku)
            .filter((s): s is string => !!s),
          errorCode: null,
        });
        const vacio = redactBusquedaVacia(diag);
        redactionParts.push(vacio.texto);
        montosPermitidos.push(...vacio.montos);
        continue;
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
    adjuntoGuion?: string | null;
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

    const response = await this.attachTrace(
      {
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
      },
      input.adjuntoGuion,
    );

    const persisted = await this.store.findById(input.conversacionId);
    if (persisted) {
      await this.expediente?.persistAfterTurn(persisted, {
        plantillaUtilityId: response.waContent?.templateId ?? null,
      });
    }

    return response;
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

  private async attachTrace(
    res: TurnResponse,
    adjuntoGuion?: string | null,
  ): Promise<TurnResponse> {
    const finished = this.reasoning.finish({
      ruta: res.ruta,
      estadoBot: res.estadoBot,
      motivoHandoff: res.motivoHandoff,
      eventoOperativoId: res.eventoOperativoId,
      registroConsultaCatalogoId: res.registroConsultaCatalogoId,
      registroRecuperacionId: res.registroRecuperacionId ?? null,
    });
    const document =
      adjuntoGuion === GUION_ADJUNTO_PAQUETE_BODAS
        ? await this.resolveGuionDocument()
        : undefined;
    return attachWaContent({
      ...res,
      reasoningTraceId: finished?.id ?? this.reasoning.currentId() ?? null,
      reasoningTrace: finished ?? this.reasoning.current() ?? null,
      document,
    });
  }

  private async resolveGuionDocument() {
    if (this.storage && this.config && isObjectStorageLive(this.config)) {
      try {
        const url = await this.storage.signedUrl({
          key: STORAGE_KEYS.guionPaqueteBodas,
          expiresInSec: GUION_SIGNED_URL_TTL_SEC,
        });
        return {
          filename: GUION_PDF_FILENAME,
          mime: "application/pdf" as const,
          url,
        };
      } catch {
        /* fallback público */
      }
    }
    return paqueteBodas2027Document();
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
    "Si mencionan un paquete por nombre informal (estándar, básico, premium, upgrade, paquete bodas), usa buscar_paquetes, comparar_paquetes u obtener_precio_paquete. Nunca digas Jardín 1 ni Esencial.",
    "Paquetes publicados: Paquete Estándar (EVT-J1-TC) y Upgrade Premium (EVT-J1-PREMIUM). XV, corporativo y solo renta: transferir_a_humano motivo sin_catalogo.",
    "Qué tiene / qué trae / qué incluye / detalle del estándar o premium: listar_inclusiones de ese SKU. Sin SKU, listar_inclusiones de ambos paquetes de boda. No uses obtener_precio_paquete para esas frases.",
    "Políticas de pago, horario de evento y exclusiones las responde otra rama; si igual te llegan, evaluar_reglas_paquete.",
    "Precios por tramo 100/150/200/250/300; no interpolar. Fecha de evento (no de consulta); si falta, 2027-06-15.",
    `Contexto ya capturado del lead: ${JSON.stringify(ctx)}`,
    "Si hay fechaTentativa, pásala como fecha ISO (YYYY-MM-DD) a buscar_paquetes y obtener_precio_paquete.",
    "La sede de catálogo es el slug tequesquitengo, nunca el nombre comercial.",
  ].join(" ");
}

function mergeCatalogToolArgs(
  name: string,
  args: Record<string, unknown>,
  campos: CamposCapturados,
): Record<string, unknown> {
  const fecha = fechaTentativaToIso(campos.fechaTentativa);
  const next = { ...args };
  if (typeof next.sku === "string") {
    next.sku = canonicalizeSku(next.sku) ?? next.sku;
  }
  if (Array.isArray(next.skus)) {
    next.skus = next.skus.map((s) =>
      typeof s === "string" ? (canonicalizeSku(s) ?? s) : s,
    );
  }
  if (name === "buscar_paquetes") {
    if (campos.tipoEvento) next.tipoEvento = campos.tipoEvento;
    else if (!next.tipoEvento) next.tipoEvento = "boda";
    const tipo = normalizeTipoEventoArg(next.tipoEvento);
    if (tipo) next.tipoEvento = tipo;
    if (next.aforo == null && campos.aforo != null) next.aforo = campos.aforo;
    if (campos.sedeId || campos.sedeNombre) {
      next.sede = SEDE_SLUG;
    } else if (next.sede != null) {
      next.sede = sedeToCatalogSlug(String(next.sede)) ?? next.sede;
    }
    if (!next.fecha && fecha) next.fecha = fecha;
  }
  if (name === "obtener_precio_paquete" || name === "comparar_paquetes") {
    if (!next.fecha && fecha) next.fecha = fecha;
    if (next.aforo == null && campos.aforo != null) next.aforo = campos.aforo;
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
    return redactPrecioPaquete(r);
  }

  if (toolName === "buscar_paquetes" && Array.isArray(result)) {
    const listed = redactBuscarPaquetes(result);
    return {
      texto: listed.texto || "Sin datos de catálogo.",
      montos: listed.montos,
      paqueteId,
      precioSnapshot,
    };
  }

  if (toolName === "listar_inclusiones") {
    const listed = redactInclusiones(r);
    return {
      texto: listed.texto,
      montos: listed.montos,
      paqueteId: listed.paqueteId,
      precioSnapshot,
    };
  }

  if (toolName === "comparar_paquetes") {
    const compared = redactCompararPaquetes(r);
    return {
      texto: compared.texto,
      montos: compared.montos,
      paqueteId,
      precioSnapshot,
    };
  }

  if (toolName === "evaluar_reglas_paquete") {
    const reglas = redactReglas(r);
    return {
      texto: reglas.texto,
      montos: reglas.montos,
      paqueteId: reglas.paqueteId,
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
