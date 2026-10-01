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
import {
  SAFE_COPY_BOT_SILENCIADO,
  SAFE_COPY_K09,
  SAFE_COPY_HANDOFF_HUMANO,
} from "../handoff/safe-copy";
import { CatalogToolsService } from "../../tools-catalog/catalog-tools.service";
import { NurtureWorkerService } from "../nurture/nurture.worker";
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
import {
  applyCatalogWriteback,
  composePedidoCatalogoFromCampos,
  evaluarPedidoCotizacion,
  harvestCamposLexical,
  isFraseInteresCotizar,
  isGuionCompleto,
  isPerfilListo,
  isRecotizarPorSlots,
  nextPasoGuion,
} from "../script/harvest-campos";
import {
  applyDefaultBoda,
  decideRutaComercial,
  decideRutaComercialV3,
  decideRutaComercialV4,
  deriveEncaje,
  deriveEncajeV3,
  effectiveConversationFlow,
  isV2Plus,
  nextPasoGuionV2,
  nextPasoGuionV3,
  nextPasoGuionV4,
  resolveConversationFlow,
  slaMinutos,
  syncCamposV2,
  syncCamposV3,
} from "../conversation-flow";
import {
  COPY_NUTRICION_T24_INMEDIATO,
  COPY_PISO_VISITA,
  COPY_V2_MENOR_PISO,
  COPY_V2_NUTRICION_EVASION,
  COPY_V2_NUTRICION_HOLD,
  COPY_V2_SEGUIMIENTO,
  copyMenorPisoConAlternativa,
  copyMenorPisoConPisoPublicado,
  COPY_V3_ADJUNTO_RETRY,
  COPY_V3_CIERRE_VISITA,
  COPY_V3_HUMANO_TEMPRANO,
  COPY_V3_RAG_SAFE_FAQ,
  COPY_V3_RAG_SAFE_VISITA,
  COPY_V3_VALOR_INLINE,
  copyV2Handoff,
} from "../script/script-v2.copy";
import {
  COPY_V4_HANDOFF_EJECUTIVO,
  COPY_V4_HANDOFF_VISITA,
} from "../script/script-v4.copy";
import { IntentClassifierService } from "./intent-classifier.service";
import {
  decideRoute,
  isAdjuntoSoportado,
} from "./routing.policies";
import {
  composeCommercialFaq,
  COPY_VISITA,
  fichaPaquetePorSku,
} from "./commercial-faq.copy";
import {
  isPackageDetailQuery,
  isPedidoFichaMasEconomico,
  matchCommercialFaqTopic,
} from "./commercial-faq.matcher";
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
import {
  paqueteBodas2027Document,
  paqueteBodasGaleria,
} from "../../channels/guion-assets";
import {
  canonicalizeSku,
  GUION_ADJUNTO_PAQUETE_BODAS,
  GUION_PDF_FILENAME,
  resolvePaqueteSkuAlias,
  SEDE_SLUG,
  SKU_PAQUETE_ESTANDAR,
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
    @Optional() private readonly catalogTools?: CatalogToolsService,
    @Optional() private readonly nurture?: NurtureWorkerService,
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

    if (!conv.guionVersion) {
      const assigned = resolveConversationFlow(this.config, {
        threadId: inbound.externalThreadId,
        sedeId: conv.camposCapturados.sedeId,
      });
      conv.guionVersion = assigned;
      await this.store.update(conv.id, { guionVersion: assigned });
    }
    const flow = this.flowOf(conv);
    const textoIn = inbound.texto ?? "";
    const pasoFrom = conv.pasoGuion;
    const harvested = harvestCamposLexical(textoIn, conv.camposCapturados, {
      focusedPaso: conv.pasoGuion,
    });
    let camposRuta =
      harvested.filled.length > 0 ? harvested.campos : conv.camposCapturados;
    if (flow === "v3") {
      camposRuta = syncCamposV3(applyDefaultBoda(camposRuta));
      this.nurture?.cancel(conv.id);
    } else if (flow === "v2") {
      camposRuta = syncCamposV2(applyDefaultBoda(camposRuta));
    }
    const capturaPendiente = this.script.isCapturaPendiente({
      ...conv,
      camposCapturados: camposRuta,
    });
    const perfilListo = isPerfilListo(camposRuta);
    const recotizarPorSlots = isRecotizarPorSlots({
      pasoGuion: conv.pasoGuion,
      perfilListo,
      intencionCotizar: camposRuta.intencionCotizar,
      filled: harvested.filled,
    });
    const pedidoEval = evaluarPedidoCotizacion({
      texto: textoIn,
      pasoGuion: conv.pasoGuion,
      campos: camposRuta,
      perfilListo,
    });
    await this.store.update(conv.id, {
      pedidoCotizacion: pedidoEval.evaluable ? pedidoEval.pedido : null,
      pedidoCotizacionFuente: pedidoEval.fuente,
    });
    if (isIntencionVisita(textoIn)) {
      camposRuta = { ...camposRuta, intencionVisita: true };
      conv.camposCapturados = camposRuta;
      await this.store.update(conv.id, {
        camposCapturados: camposRuta,
      });
    }
    const route = decideRoute({
      estadoBot: conv.estadoBot,
      hardQuota,
      texto: textoIn,
      pasoGuion: conv.pasoGuion,
      capturaPendiente,
      adjuntoInvalido,
      intent,
      buttonPayload: inbound.buttonPayload,
      pedidoCotizacion: pedidoEval.pedido === true,
      perfilListo,
      recotizarPorSlots,
      flow,
      campos: camposRuta,
      adjuntoReintentos: camposRuta.adjuntoReintentos ?? 0,
    });
    if (
      (harvested.filled.length > 0 || isV2Plus(flow)) &&
      route.kind !== "guion" &&
      route.kind !== "answer_inline" &&
      route.kind !== "degrade_script"
    ) {
      const nextPaso =
        flow === "v4"
          ? nextPasoGuionV4(camposRuta)
          : flow === "v3"
          ? nextPasoGuionV3(camposRuta)
          : flow === "v2"
            ? nextPasoGuionV2(camposRuta)
            : nextPasoGuion(harvested.campos);
      conv.camposCapturados = camposRuta;
      conv.pasoGuion = nextPaso;
      await this.store.update(conv.id, {
        camposCapturados: camposRuta,
        pasoGuion: nextPaso,
      });
      this.reasoning.append({
        level: "guion",
        pasoFrom,
        pasoTo: nextPaso,
        camposDelta: harvested.filled as string[],
      });
    }
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
        perfilListo,
        pedidoCotizacion: pedidoEval.pedido,
        pedidoCotizacionFuente: pedidoEval.fuente,
        recotizarPorSlots,
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
        textoRespuesta:
          conv.estadoBot === "humano" ? SAFE_COPY_BOT_SILENCIADO : "",
        ruta: "silencio",
        estadoBot: conv.estadoBot,
        eventoOperativoId: ev.id,
        registroConsultaCatalogoId: null,
        registroRecuperacionId: null,
        motivoHandoff: conv.motivoHandoff,
        pasoGuion: conv.pasoGuion,
      });
    }

    if (route.kind === "degrade_script") {
      return this.runGuion(conv.id, inbound.texto ?? "", msgIn.id);
    }

    if (route.kind === "adjunto_retry") {
      const nextCampos = {
        ...camposRuta,
        adjuntoReintentos: (camposRuta.adjuntoReintentos ?? 0) + 1,
      };
      await this.store.update(conv.id, { camposCapturados: nextCampos });
      return this.finishReply({
        conversacionId: conv.id,
        oportunidadId: conv.oportunidadId,
        texto: COPY_V3_ADJUNTO_RETRY,
        ruta: "safe",
        mensajeEntranteId: msgIn.id,
        pasoGuion: conv.pasoGuion,
      });
    }

    if (route.kind === "answer_inline") {
      return this.runAnswerInline(conv.id, inbound.texto ?? "", msgIn.id);
    }

    if (route.kind === "jump_visita") {
      const visitaCampos = {
        ...camposRuta,
        intencionVisita: true,
        rutaComercial: "handoff" as const,
      };
      await this.store.update(conv.id, { camposCapturados: visitaCampos });
      return this.finishHandoff(
        conv.id,
        conv.oportunidadId,
        "solicitud_usuario",
        msgIn.id,
        null,
        null,
        { cola: "comercial", rutaComercial: "handoff", visita: true },
      );
    }

    if (route.kind === "quota_hard" || route.kind === "handoff") {
      const motivo: MotivoHandoff =
        route.kind === "quota_hard" ? "cupo_ia" : route.motivo;
      const cola = route.kind === "handoff" ? route.cola : undefined;
      const rutaComercial =
        route.kind === "handoff" ? route.rutaComercial : undefined;
      const humanoTemprano =
        flow === "v3" &&
        cola === "atencion_general" &&
        motivo === "solicitud_usuario";
      return this.finishHandoff(
        conv.id,
        conv.oportunidadId,
        motivo,
        msgIn.id,
        null,
        null,
        { cola, rutaComercial, humanoTemprano },
      );
    }

    if (route.kind === "nutricion") {
      return this.runNutricion(conv.id, msgIn.id, route.motivo, textoIn);
    }

    if (route.kind === "seguimiento") {
      return this.runSeguimiento(conv.id, msgIn.id);
    }

    if (route.kind === "guion") {
      return this.runGuion(conv.id, inbound.texto ?? "", msgIn.id);
    }

    if (route.kind === "catalogo") {
      const catalogTexto = catalogQueryText(textoIn, camposRuta);
      return this.runCatalogo(conv.id, catalogTexto, msgIn.id);
    }

    if (route.kind === "faq_comercial") {
      return this.runFaqComercial(conv.id, inbound.texto ?? "", msgIn.id);
    }

    if (route.kind === "rag") {
      return this.runRag(conv.id, inbound.texto ?? "", msgIn.id);
    }

    return this.finishSafe(conv.id, conv.oportunidadId, msgIn.id, null);
  }

  private async runAnswerInline(
    conversacionId: string,
    texto: string,
    mensajeEntranteId: string,
  ): Promise<TurnResponse> {
    const conv = (await this.store.findById(conversacionId))!;
    const result = await this.script.handleTurn(conv, texto);
    await this.store.update(conversacionId, {
      pasoGuion: result.pasoGuion,
      camposCapturados: result.camposCapturados,
      ultimaRuta: "catalogo",
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
    const pregunta = result.textoRespuesta.trim();
    const textoOut = pregunta
      ? `${COPY_V3_VALOR_INLINE}\n\n${pregunta}`
      : COPY_V3_VALOR_INLINE;
    return this.finishReply({
      conversacionId,
      oportunidadId: conv.oportunidadId,
      texto: textoOut,
      ruta: "catalogo",
      mensajeEntranteId,
      pasoGuion: result.pasoGuion,
      calificacionResultado: crm.calificado ? "calificado" : "parcial",
      listoParaCotizar: crm.listoParaCotizar,
    });
  }

  private async runGuion(
    conversacionId: string,
    texto: string,
    mensajeEntranteId: string,
  ): Promise<TurnResponse> {
    const conv = (await this.store.findById(conversacionId))!;
    const pasoFrom = conv.pasoGuion;
    const result = await this.script.handleTurn(conv, texto);

    if (!result.textoRespuesta.trim()) {
      const campos = result.camposCapturados;
      await this.store.update(conversacionId, {
        pasoGuion: result.pasoGuion,
        camposCapturados: campos,
      });
      const flow = this.flowOf(conv);
      if (flow === "v4" || campos.ctaGuion) {
        if (
          (flow === "v4" && decideRutaComercialV4(campos) === "nutricion") ||
          (flow !== "v4" &&
            campos.ctaGuion === "fuera_presupuesto" &&
            campos.rangoPresupuestoFuera)
        ) {
          return this.runNutricion(
            conversacionId,
            mensajeEntranteId,
            "menor_piso",
            texto,
          );
        }
        return this.finishHandoff(
          conversacionId,
          conv.oportunidadId,
          "solicitud_usuario",
          mensajeEntranteId,
          null,
          null,
          {
            cola: "comercial",
            rutaComercial: "handoff",
            visita: campos.ctaGuion === "visita",
          },
        );
      }
      const ruta =
        flow === "v3" ? decideRutaComercialV3(campos) : decideRutaComercial(campos);
      if (ruta === "seguimiento") {
        return this.runSeguimiento(conversacionId, mensajeEntranteId);
      }
      if (ruta === "nutricion") {
        return this.runNutricion(
          conversacionId,
          mensajeEntranteId,
          "evasion",
          texto,
        );
      }
      if (
        ruta === "handoff" ||
        (flow === "v3"
          ? deriveEncajeV3(campos) === "confirmado" ||
            deriveEncajeV3(campos) === "probable"
          : deriveEncaje(campos) === "confirmado")
      ) {
        return this.finishHandoff(
          conversacionId,
          conv.oportunidadId,
          "solicitud_usuario",
          mensajeEntranteId,
          null,
          null,
          { cola: "comercial", rutaComercial: "handoff" },
        );
      }
      return this.runNutricion(
        conversacionId,
        mensajeEntranteId,
        "evasion",
        texto,
      );
    }

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

    if (
      deriveEncaje(result.camposCapturados) === "confirmado" &&
      deriveEncaje(conv.camposCapturados) !== "confirmado"
    ) {
      await this.audit.emit({
        tipo: "bot_rango_aceptado",
        conversacionId,
        oportunidadId: conv.oportunidadId,
        mensajeId: mensajeEntranteId,
        payload: {
          rangoInversion: result.camposCapturados.rangoInversion ?? null,
          encajeEconomico: result.camposCapturados.encajeEconomico ?? null,
        },
      });
    }

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
      : topic
        ? composeCommercialFaq(topic)
        : composeCommercialFaq("overview");
    this.reasoning.append({
      level: "catalog_tools",
      tools: [
        {
          nombre: "faq_comercial",
          ok: true,
          filasSku: [visita ? "visita" : topic ?? "overview"],
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
    let lastCatalogArgs: Record<string, unknown> = {};

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
      if (
        call.name === "buscar_paquetes" ||
        call.name === "obtener_precio_paquete"
      ) {
        lastCatalogArgs = args;
      }

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

    const campos = applyCatalogWriteback(
      conv.camposCapturados,
      lastCatalogArgs,
      texto,
    );
    const pasoGuion = this.flowOf(conv) === "v4"
      ? nextPasoGuionV4(campos)
      : isGuionCompleto(campos)
      ? "faq_libre"
      : this.flowOf(conv) === "v3"
        ? nextPasoGuionV3(campos)
        : this.flowOf(conv) === "v2"
          ? nextPasoGuionV2(campos)
          : nextPasoGuion(campos);

    await this.store.update(conversacionId, {
      paqueteTentativoId: paqueteId,
      ultimaRuta: "catalogo",
      camposCapturados: campos,
      pasoGuion,
    });

    const registroRow = registroId
      ? await this.registroCatalogo.findById(registroId)
      : null;
    const consultaCatalogo = registroRow
      ? {
          id: registroRow.id,
          tool: String(registroRow.tool),
          input: registroRow.input,
          filasSku: registroRow.filasSku,
          ok: registroRow.ok,
          creadoEn: registroRow.creadoEn,
        }
      : null;
    if (consultaCatalogo) {
      await this.audit.emit({
        tipo: "consulta_catalogo",
        conversacionId,
        oportunidadId: conv.oportunidadId,
        mensajeId: mensajeEntranteId,
        payload: {
          ...consultaCatalogo,
          paqueteTentativoId: paqueteId,
          tools: toolPayloads,
        },
      });
    }

    const refreshed = (await this.store.findById(conversacionId))!;
    const crm = await this.crm.applyAfterTurn(refreshed, {
      paqueteTentativoId: paqueteId,
      precioSnapshot,
      registroConsultaCatalogoId: registroId,
      consultaCatalogo,
    });
    await this.store.update(conversacionId, {
      brief: crm.brief,
      calificado: crm.calificado,
      listoParaCotizar: crm.listoParaCotizar,
    });

    this.emitCatalogTools(toolPayloads, "pass");

    const encajeOk = deriveEncaje(campos) === "confirmado";
    return this.finishReply({
      conversacionId,
      oportunidadId: conv.oportunidadId,
      texto: textoRespuesta,
      ruta: "catalogo",
      mensajeEntranteId,
      pasoGuion,
      tools: toolPayloads,
      registroConsultaCatalogoId: registroId,
      calificacionResultado: crm.calificado ? "calificado" : "parcial",
      listoParaCotizar: crm.listoParaCotizar,
      adjuntoGuion:
        encajeOk && this.flowOf(conv) === "v2"
          ? GUION_ADJUNTO_PAQUETE_BODAS
          : undefined,
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
      if (this.flowOf(conv) === "v3") {
        const encaje = deriveEncajeV3(conv.camposCapturados);
        const texto =
          encaje === "confirmado" || encaje === "probable"
            ? COPY_V3_RAG_SAFE_VISITA
            : COPY_V3_RAG_SAFE_FAQ;
        await this.store.update(conversacionId, { ultimaRuta: "safe" });
        return this.finishReply({
          conversacionId,
          oportunidadId: conv.oportunidadId,
          texto,
          ruta: "safe",
          mensajeEntranteId,
          pasoGuion: conv.pasoGuion,
          registroRecuperacionId: result.registroRecuperacionId ?? null,
        });
      }
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

  private async runNutricion(
    conversacionId: string,
    mensajeEntranteId: string,
    motivo: "menor_piso" | "evasion",
    textoProspecto: string,
  ): Promise<TurnResponse> {
    const conv = (await this.store.findById(conversacionId))!;
    const yaNutricion = conv.camposCapturados.rutaComercial === "nutricion";

    if (yaNutricion) {
      const ficha = await this.fichaNutricionSiAplica(textoProspecto);
      if (ficha) {
        return this.finishReply({
          conversacionId,
          oportunidadId: conv.oportunidadId,
          texto: ficha,
          ruta: "catalogo",
          mensajeEntranteId,
          pasoGuion: "faq_libre",
        });
      }
      return this.finishReply({
        conversacionId,
        oportunidadId: conv.oportunidadId,
        texto: COPY_V2_NUTRICION_HOLD,
        ruta: "safe",
        mensajeEntranteId,
        pasoGuion: "faq_libre",
      });
    }

    const campos = {
      ...conv.camposCapturados,
      rutaComercial: "nutricion" as const,
      consentimientoSeguimiento: true,
    };
    await this.store.update(conversacionId, {
      camposCapturados: campos,
      pasoGuion: "faq_libre",
      ultimaRuta: "safe",
    });
    await this.audit.emit({
      tipo: "bot_nutricion",
      conversacionId,
      oportunidadId: conv.oportunidadId,
      mensajeId: mensajeEntranteId,
      payload: {
        motivo,
        encajeEconomico: campos.encajeEconomico ?? null,
        rutaComercial: "nutricion",
        pasoAbandonado: conv.pasoGuion,
      },
    });
    if (motivo === "evasion") {
      await this.audit.emit({
        tipo: "bot_abandono_paso",
        conversacionId,
        oportunidadId: conv.oportunidadId,
        mensajeId: mensajeEntranteId,
        payload: {
          paso: conv.pasoGuion,
          numeroMensajesCaptura: campos.numeroMensajesCaptura ?? 0,
          numeroAclaracionesPiso: campos.numeroAclaracionesPiso ?? 0,
        },
      });
    }
    let texto =
      motivo === "menor_piso" ? COPY_V2_MENOR_PISO : COPY_V2_NUTRICION_EVASION;
    const pisoSinRespuesta =
      campos.rangoInversion === "por_definir" &&
      campos.aceptaPiso250k == null &&
      (campos.numeroAclaracionesPiso ?? 0) >= 1;
    if (
      motivo === "evasion" &&
      (conv.pasoGuion === "aclaracion_piso" || pisoSinRespuesta)
    ) {
      texto = COPY_NUTRICION_T24_INMEDIATO;
    }
    if (motivo === "menor_piso" && this.catalogTools) {
      try {
        const alt = await this.catalogTools.findSkuBajoPiso();
        if (alt) {
          texto = copyMenorPisoConAlternativa(alt.nombre);
        } else {
          const piso = await this.catalogTools.findSkuPisoVigente();
          if (piso) {
            texto = copyMenorPisoConPisoPublicado(piso.nombre);
          }
        }
      } catch {
        /* copy honesto sin SKU */
      }
    }
    this.nurture?.schedule({
      conversacionId,
      nombre: campos.nombre,
      consentimiento: Boolean(campos.consentimientoSeguimiento),
    });
    return this.finishReply({
      conversacionId,
      oportunidadId: conv.oportunidadId,
      texto,
      ruta: "safe",
      mensajeEntranteId,
      pasoGuion: "faq_libre",
    });
  }

  private async fichaNutricionSiAplica(
    texto: string,
  ): Promise<string | null> {
    if (!isPedidoFichaMasEconomico(texto) && !isPackageDetailQuery(texto)) {
      return null;
    }
    const named = resolvePaqueteSkuAlias(texto);
    if (named) {
      return fichaPaquetePorSku(named);
    }
    let sku = SKU_PAQUETE_ESTANDAR;
    if (this.catalogTools) {
      try {
        const piso = await this.catalogTools.findSkuPisoVigente();
        if (piso?.sku) sku = piso.sku;
      } catch {
        /* ficha evergreen */
      }
    }
    return fichaPaquetePorSku(sku);
  }

  private async runSeguimiento(
    conversacionId: string,
    mensajeEntranteId: string,
  ): Promise<TurnResponse> {
    const conv = (await this.store.findById(conversacionId))!;
    const campos = {
      ...conv.camposCapturados,
      rutaComercial: "seguimiento" as const,
      consentimientoSeguimiento: true,
    };
    await this.store.update(conversacionId, {
      camposCapturados: campos,
      pasoGuion: "faq_libre",
      ultimaRuta: "guion",
    });
    await this.audit.emit({
      tipo: "bot_seguimiento",
      conversacionId,
      oportunidadId: conv.oportunidadId,
      mensajeId: mensajeEntranteId,
      payload: {
        encajeEconomico: campos.encajeEconomico ?? null,
        rutaComercial: "seguimiento",
      },
    });
    return this.finishReply({
      conversacionId,
      oportunidadId: conv.oportunidadId,
      texto: COPY_V2_SEGUIMIENTO,
      ruta: "guion",
      mensajeEntranteId,
      pasoGuion: "faq_libre",
    });
  }

  private async finishHandoff(
    conversacionId: string,
    oportunidadId: string,
    motivo: MotivoHandoff,
    mensajeEntranteId: string,
    registroConsultaCatalogoId: string | null = null,
    registroRecuperacionId: string | null = null,
    opts?: {
      cola?: "comercial" | "atencion_general";
      rutaComercial?: import("../types").RutaComercial;
      visita?: boolean;
      humanoTemprano?: boolean;
    },
  ): Promise<TurnResponse> {
    this.reasoning.append({
      level: "handoff",
      motivo,
    });
    const conv = (await this.store.findById(conversacionId))!;
    const rutaComercial =
      opts?.rutaComercial ??
      (opts?.cola === "atencion_general" ? "atencion_general" : "handoff");
    const campos = {
      ...conv.camposCapturados,
      rutaComercial,
      encajeEconomico:
        conv.camposCapturados.encajeEconomico ??
        (opts?.cola === "atencion_general" ? ("no_confirmado" as const) : conv.camposCapturados.encajeEconomico),
    };
    await this.store.update(conversacionId, { camposCapturados: campos });

    const flow = this.flowOf(conv);
    const encajeV3 = deriveEncajeV3(campos);
    const comercial =
      (flow === "v2" &&
        opts?.cola !== "atencion_general" &&
        deriveEncaje(campos) === "confirmado") ||
      (flow === "v3" &&
        opts?.cola !== "atencion_general" &&
        (encajeV3 === "confirmado" || encajeV3 === "probable"));
    const sla = slaMinutos(opts?.cola);
    await this.store.update(conversacionId, {
      cola: opts?.cola ?? "comercial",
      slaVenceEn: new Date(Date.now() + sla * 60_000).toISOString(),
    });
    if (comercial) {
      await this.audit.emit({
        tipo: "bot_rango_aceptado",
        conversacionId,
        oportunidadId,
        mensajeId: mensajeEntranteId,
        payload: {
          rangoInversion: campos.rangoInversion ?? null,
          encajeEconomico: campos.encajeEconomico ?? null,
          cola: "comercial",
        },
      });
    }
    const safeCopy =
      flow === "v4" && opts?.cola !== "atencion_general"
        ? opts?.visita
          ? COPY_V4_HANDOFF_VISITA(campos.nombre)
          : COPY_V4_HANDOFF_EJECUTIVO(campos.nombre)
        : flow === "v3" && opts?.humanoTemprano
        ? COPY_V3_HUMANO_TEMPRANO
        : flow === "v3" && (opts?.visita || comercial)
          ? COPY_V3_CIERRE_VISITA(campos.nombre)
          : flow === "v2" && (opts?.visita || comercial)
            ? opts?.visita
              ? COPY_PISO_VISITA
              : copyV2Handoff(campos)
            : flow === "v3" && opts?.cola === "atencion_general"
              ? SAFE_COPY_HANDOFF_HUMANO
              : undefined;

    const hand = await this.handoff.escalate({
      conversacionId,
      motivo,
      oportunidadId,
      mensajeId: mensajeEntranteId,
      safeCopy,
      extraPayload: {
        cola: opts?.cola ?? "comercial",
        rutaComercial,
        encajeEconomico: campos.encajeEconomico ?? null,
        intencionNivel: campos.intencionNivel ?? null,
      },
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
      adjuntoGuion:
        comercial && encajeV3 !== "no" ? GUION_ADJUNTO_PAQUETE_BODAS : undefined,
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
        perfilListo: isPerfilListo(conv.camposCapturados),
        pedidoCotizacion: conv.pedidoCotizacion ?? null,
        pedidoCotizacionFuente: conv.pedidoCotizacionFuente ?? null,
        encajeEconomico: conv.camposCapturados.encajeEconomico ?? null,
        intencionNivel: conv.camposCapturados.intencionNivel ?? null,
        rutaComercial: conv.camposCapturados.rutaComercial ?? null,
        registroConsultaCatalogoId: input.registroConsultaCatalogoId ?? null,
        registroRecuperacionId: input.registroRecuperacionId ?? null,
        mensajeEntranteId: input.mensajeEntranteId,
      },
    });

    if (this.flowOf(conv) === "v3") {
      await this.audit.emit({
        tipo: "conversation_turn_v3",
        conversacionId: input.conversacionId,
        oportunidadId: input.oportunidadId,
        mensajeId: msgOut.id,
        payload: {
          pasoGuion: input.pasoGuion ?? conv.pasoGuion,
          ruta: input.ruta,
          encaje: conv.camposCapturados.encajeEconomico ?? null,
          intencion: conv.camposCapturados.intencionNivel ?? null,
          intent: conv.pedidoCotizacionFuente ?? null,
          interrupcion: input.ruta !== "guion",
          slots: Object.keys(conv.camposCapturados).filter(
            (k) => conv.camposCapturados[k as keyof CamposCapturados] != null,
          ),
        },
      });
    }

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
    const convForPdf = await this.store.findById(res.conversacionId);
    const flow = this.flowOf(convForPdf);
    const encaje = deriveEncaje(convForPdf?.camposCapturados ?? {});
    const encaje3 = deriveEncajeV3(convForPdf?.camposCapturados ?? {});
    const paqueteTemprano =
      (flow === "v2" || flow === "v3" || flow === "v4") &&
      adjuntoGuion === GUION_ADJUNTO_PAQUETE_BODAS &&
      !convForPdf?.camposCapturados.pdfEnviado;
    const allowPdf =
      flow === "v1" ||
      paqueteTemprano ||
      encaje === "confirmado" ||
      (flow === "v3" && (encaje3 === "confirmado" || encaje3 === "probable"));
    const document =
      adjuntoGuion === GUION_ADJUNTO_PAQUETE_BODAS && allowPdf
        ? await this.resolveGuionDocument()
        : undefined;
    const images =
      document && paqueteTemprano ? paqueteBodasGaleria() : undefined;
    if (document && convForPdf) {
      await this.store.update(res.conversacionId, {
        camposCapturados: {
          ...convForPdf.camposCapturados,
          pdfEnviado: true,
        },
      });
    }
    return attachWaContent({
      ...res,
      reasoningTraceId: finished?.id ?? this.reasoning.currentId() ?? null,
      reasoningTrace: finished ?? this.reasoning.current() ?? null,
      document,
      aforo: convForPdf?.camposCapturados.aforo,
      fechaTentativa: convForPdf?.camposCapturados.fechaTentativa ?? null,
      accionModo:
        flow === "v4" || res.pasoGuion === "accion" ? "cta_v4" : "legacy",
      images,
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

  private flowOf(
    conv?: Pick<ConversacionState, "guionVersion"> | null,
  ) {
    return effectiveConversationFlow(conv ?? {}, this.config);
  }
}

function catalogQueryText(texto: string, campos: CamposCapturados): string {
  if (isIntencionMonetaria(texto) || isFraseInteresCotizar(texto)) {
    return texto;
  }
  return composePedidoCatalogoFromCampos(campos);
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
    const tipo = normalizeTipoEventoArg(next.tipoEvento);
    if (tipo) next.tipoEvento = tipo;
    if (campos.aforo != null) next.aforo = campos.aforo;
    if (campos.sedeId || campos.sedeNombre) {
      next.sede = SEDE_SLUG;
    } else if (next.sede != null) {
      next.sede = sedeToCatalogSlug(String(next.sede)) ?? next.sede;
    }
    if (fecha) next.fecha = fecha;
  }
  if (name === "obtener_precio_paquete" || name === "comparar_paquetes") {
    if (fecha) next.fecha = fecha;
    if (campos.aforo != null) next.aforo = campos.aforo;
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
      paqueteId: firstPaqueteId(result),
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

function firstPaqueteId(result: unknown): string | null {
  if (!result) return null;
  if (Array.isArray(result)) {
    for (const item of result) {
      if (!item || typeof item !== "object") continue;
      const id = (item as { id?: unknown }).id;
      if (typeof id === "string" && id) return id;
    }
    return null;
  }
  if (typeof result === "object") {
    const rec = result as { paqueteId?: unknown; id?: unknown };
    if (typeof rec.paqueteId === "string" && rec.paqueteId) return rec.paqueteId;
    if (typeof rec.id === "string" && rec.id) return rec.id;
  }
  return null;
}

/** Re-export tipado del fake catalog-aware (tests). */
export { CatalogAwareLlmPort } from "../stubs/catalog-aware-llm.port";
