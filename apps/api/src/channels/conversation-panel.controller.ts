import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpException,
  HttpStatus,
  NotFoundException,
  Optional,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import type { BriefCardDto } from "@tres-cielos/shared";
import { ConversationStateStore } from "./conversation-state.store";
import { AuditService } from "../audit/audit.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { PanelUser } from "../auth/auth.types";
import { ExpedientePersistService } from "../crm/expediente-persist.service";
import { ConversationStoreService } from "../conversation/stubs/conversation-store.service";
import { PrismaService } from "../prisma/prisma.service";
import type { CamposCapturados } from "../conversation/types";
import { NurtureWorkerService } from "../conversation/nurture/nurture.worker";

const DEVOLVER_OK = new Set([
  "asesor_libera",
  "sla_vencido",
  "cola_general_resuelta",
]);

@Controller("conversaciones")
@UseGuards(JwtAuthGuard)
export class ConversationPanelController {
  constructor(
    private readonly conversations: ConversationStateStore,
    private readonly audit: AuditService,
    private readonly expediente: ExpedientePersistService,
    private readonly orchStore: ConversationStoreService,
    private readonly prisma: PrismaService,
    @Optional() private readonly nurture?: NurtureWorkerService,
  ) {}

  @Get()
  async listar(@Query("cola") cola?: string) {
    if (!process.env.DATABASE_URL) {
      return { data: [] };
    }
    const rows = await this.prisma.conversacion.findMany({
      where: {
        ...(cola === "comercial" || cola === "atencion_general"
          ? { cola }
          : {
              OR: [
                { estadoBot: { in: ["escalado", "humano"] } },
                { cola: { not: null } },
              ],
            }),
      },
      orderBy: { actualizadoEn: "desc" },
      take: 80,
    });
    const now = Date.now();
    return {
      data: rows.map((row) => {
        const campos = (row.camposCapturados ?? {}) as CamposCapturados;
        const sla = row.slaVenceEn?.getTime();
        return {
          id: row.id,
          clienteId: row.clienteId,
          cola: row.cola,
          estadoBot: row.estadoBot,
          slaVenceEn: row.slaVenceEn?.toISOString() ?? null,
          asesorLockId: row.asesorLockId ?? null,
          urgenciaSla:
            sla == null ? null : sla < now ? "fuera" : "dentro",
          brief: briefFromCampos(campos),
        };
      }),
    };
  }

  @Get(":id")
  async detalle(@Param("id") id: string) {
    const orch = await this.orchStore.findById(id);
    if (orch) {
      return {
        id: orch.id,
        estadoBot: orch.estadoBot,
        pasoGuion: orch.pasoGuion,
        cola: orch.cola ?? null,
        asesorLockId: orch.asesorLockId ?? null,
        slaVenceEn: orch.slaVenceEn ?? null,
        brief: briefFromCampos(orch.camposCapturados, ultimaPregunta(orch)),
      };
    }
    if (process.env.DATABASE_URL) {
      const row = await this.prisma.conversacion.findUnique({ where: { id } });
      if (row) {
        const campos = (row.camposCapturados ?? {}) as CamposCapturados;
        return {
          id: row.id,
          estadoBot: row.estadoBot,
          pasoGuion: row.pasoGuion,
          cola: row.cola,
          asesorLockId: row.asesorLockId ?? null,
          slaVenceEn: row.slaVenceEn?.toISOString() ?? null,
          brief: briefFromCampos(campos),
        };
      }
    }
    const mem = this.conversations.getById(id);
    if (!mem) throw new NotFoundException("CONVERSACION_NOT_FOUND");
    return { id: mem.id, estadoBot: mem.estadoBot, brief: briefFromCampos({}) };
  }

  @Post(":id/tomar-control")
  @HttpCode(200)
  async tomarControl(
    @Param("id") id: string,
    @Body() body: { motivo?: string },
    @CurrentUser() user: PanelUser,
  ) {
    const lock = await this.expediente.findLock(id);
    if (lock && lock !== user.userId) {
      throw new HttpException(
        {
          error: {
            code: "OWNERSHIP_CONFLICT",
            message: "Otro asesor ya tomó este hilo",
          },
        },
        HttpStatus.CONFLICT,
      );
    }
    const canal = this.conversations.getById(id);
    const orch = await this.orchStore.findById(id);
    if (!canal && !orch && !(await this.prismaRow(id))) {
      throw new NotFoundException("CONVERSACION_NOT_FOUND");
    }
    const anterior = orch?.estadoBot ?? canal?.estadoBot ?? "activo";
    if (canal) this.conversations.setEstadoBot(id, "humano");
    if (orch) {
      await this.orchStore.update(id, {
        estadoBot: "humano",
        asesorLockId: user.userId,
      });
    }
    const evento = await this.audit.record({
      tipo: "toma_control",
      actor: "asesor",
      conversacionId: id,
      payload: {
        estadoBotAnterior: anterior,
        estadoBotNuevo: "humano",
        usuarioId: user.userId,
        motivo: body.motivo ?? null,
      },
    });
    await this.expediente.persistTomaControl({
      conversacionId: id,
      usuarioId: user.userId,
      motivo: body.motivo ?? null,
    });
    return {
      id,
      estadoBot: "humano",
      eventoOperativoId: evento.id,
    };
  }

  @Post(":id/devolver-a-bot")
  async devolverABot(
    @Param("id") id: string,
    @Body() body: { motivo?: string },
  ) {
    const motivo = body?.motivo ?? "";
    if (!DEVOLVER_OK.has(motivo)) {
      throw new HttpException(
        {
          error: {
            code: "DEVOLUCION_BOT_DESHABILITADA",
            message: "Política v1: devolver a bot deshabilitado",
          },
        },
        HttpStatus.CONFLICT,
      );
    }
    const orch = await this.orchStore.findById(id);
    if (orch) {
      const campos = {
        ...orch.camposCapturados,
        rutaComercial: "nutricion" as const,
        consentimientoSeguimiento: true,
      };
      await this.orchStore.update(id, {
        estadoBot: "activo",
        asesorLockId: null,
        slaVenceEn: null,
        pasoGuion: "faq_libre",
        camposCapturados: campos,
      });
      this.nurture?.schedule({
        conversacionId: id,
        nombre: campos.nombre,
        consentimiento: true,
      });
    }
    const canal = this.conversations.getById(id);
    if (canal) this.conversations.setEstadoBot(id, "activo");
    await this.expediente.persistDevolverABot({ conversacionId: id, motivo });
    const evento = await this.audit.record({
      tipo: "devolver_a_bot",
      actor: "asesor",
      conversacionId: id,
      payload: { motivo },
    });
    return {
      id,
      estadoBot: "activo",
      eventoOperativoId: evento.id,
    };
  }

  private async prismaRow(id: string) {
    if (!process.env.DATABASE_URL) return null;
    try {
      return await this.prisma.conversacion.findUnique({ where: { id } });
    } catch {
      return null;
    }
  }
}

function ultimaPregunta(conv: {
  mensajes: Array<{ direccion: string; contenido: string }>;
}): string | null {
  const last = [...conv.mensajes]
    .reverse()
    .find((m) => m.direccion === "saliente" && m.contenido.includes("¿"));
  return last?.contenido ?? null;
}

function briefFromCampos(
  campos: CamposCapturados,
  ultima: string | null = null,
): BriefCardDto {
  return {
    nombre: campos.nombre ?? null,
    ocasion: campos.tipoEvento ?? null,
    fechaEstado: campos.fechaEstado ?? null,
    aforo: campos.aforo ?? null,
    rango: campos.rangoInversion ?? null,
    encaje: campos.encajeEconomico ?? null,
    intencion: campos.intencionNivel ?? null,
    ruta: campos.rutaComercial ?? null,
    ultimaPregunta: ultima,
    pdfEnviado: Boolean(campos.pdfEnviado),
  };
}
