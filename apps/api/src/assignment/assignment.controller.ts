import { Body, Controller, Get, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import type { PanelUser } from "../auth/auth.types";
import { AssignmentEngine } from "./assignment-engine.service";

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("coordinador", "admin")
export class AssignmentController {
  constructor(private readonly engine: AssignmentEngine) {}

  @Get("asignacion/carga")
  async carga(@CurrentUser() actor: PanelUser) {
    return { data: await this.engine.carga(actor) };
  }

  @Get("asignacion/cola")
  async cola(@CurrentUser() actor: PanelUser) {
    const filas = await this.engine.listarCola(actor);
    return {
      data: filas.map((fila) => ({
        id: fila.id,
        oportunidadId: fila.oportunidadId,
        clienteId: fila.oportunidad.clienteId,
        nombre: fila.oportunidad.cliente.nombre,
        calificacion: fila.oportunidad.calificacion,
        tipoEvento: fila.oportunidad.tipoEvento,
        sedeId: fila.sedeId,
        disparador: fila.disparador,
        motivo: fila.motivo,
        detalle: fila.detalle,
        creadoEn: fila.creadoEn.toISOString(),
      })),
    };
  }

  @Post("asignaciones")
  async reasignar(
    @CurrentUser() actor: PanelUser,
    @Body() body: { oportunidadId?: string; asesorId?: string; motivo?: string },
  ) {
    const res = await this.engine.reasignar(actor, {
      oportunidadId: body.oportunidadId ?? "",
      asesorId: body.asesorId ?? "",
      motivo: body.motivo,
    });
    return {
      data: {
        oportunidadId: body.oportunidadId,
        asesorId: res.asesorId,
        regla: "manual",
        estado: res.estado,
      },
    };
  }
}
