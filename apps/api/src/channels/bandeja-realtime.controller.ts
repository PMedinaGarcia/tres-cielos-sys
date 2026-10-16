import { Controller, Query, Sse, UseGuards } from "@nestjs/common";
import { Observable } from "rxjs";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import {
  PanelRealtimeService,
  type PanelRealtimeEvent,
} from "../panel-realtime/panel-realtime.service";

@Controller("panel")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("asesor", "coordinador", "admin")
export class BandejaRealtimeController {
  constructor(private readonly realtime: PanelRealtimeService) {}

  @Sse("eventos")
  eventos(
    @Query("clienteId") clienteId?: string,
  ): Observable<{ data: PanelRealtimeEvent }> {
    const id = clienteId?.trim();
    if (id) return this.realtime.streamForCliente(id);
    return this.realtime.stream();
  }
}
