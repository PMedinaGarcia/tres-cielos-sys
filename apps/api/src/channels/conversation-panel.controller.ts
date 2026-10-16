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
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import type { BriefCardDto } from "@tres-cielos/shared";
import { ConversationStateStore } from "./conversation-state.store";
import { AuditService } from "../audit/audit.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { PanelUser } from "../auth/auth.types";
import { BandejaService } from "./bandeja.service";
import { ExpedientePersistService } from "../crm/expediente-persist.service";
import { ConversationStoreService } from "../conversation/stubs/conversation-store.service";
import { PrismaService } from "../prisma/prisma.service";
import type { CamposCapturados } from "../conversation/types";
import { labelFechaEventoBrief } from "../conversation/script/harvest-campos";
import { NurtureWorkerService } from "../conversation/nurture/nurture.worker";

const DEVOLVER_OK = new Set([
  "asesor_libera",
  "sla_vencido",
  "cola_general_resuelta",
]);

@Controller("conversaciones")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("asesor", "coordinador", "admin")
export class ConversationPanelController {
  constructor(
    private readonly conversations: ConversationStateStore,
    private readonly audit: AuditService,
    private readonly expediente: ExpedientePersistService,
    private readonly orchStore: ConversationStoreService,
    private readonly prisma: PrismaService,
    private readonly bandeja: BandejaService,
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
  tomarControl(
    @Param("id") id: string,
    @Body() body: { motivo?: string },
    @CurrentUser() user: PanelUser,
  ) {
    return this.bandeja.tomarControl(id, body ?? {}, user);
  }

  @Post(":id/mensajes")
  @HttpCode(200)
  enviarMensaje(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: PanelUser,
  ) {
    return this.bandeja.enviarMensaje(id, body, user);
  }

  @Patch(":id/brief")
  actualizarBrief(
    @Param("id") id: string,
    @Body() body: unknown,
    @CurrentUser() user: PanelUser,
  ) {
    return this.bandeja.actualizarBrief(id, body, user);
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
      await this.orchStore.update(id, {
        estadoBot: "activo",
        asesorLockId: null,
        slaVenceEn: null,
      });
      this.nurture?.schedule({
        conversacionId: id,
        nombre: orch.camposCapturados.nombre,
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
    fechaEstado: labelFechaEventoBrief(campos),
    aforo: campos.aforo ?? null,
    rango: campos.rangoInversion ?? null,
    encaje: campos.encajeEconomico ?? null,
    intencion: campos.intencionNivel ?? null,
    ruta: campos.rutaComercial ?? null,
    ultimaPregunta: ultima,
    pdfEnviado: Boolean(campos.pdfEnviado),
  };
}
