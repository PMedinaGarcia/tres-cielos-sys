import {
  Body,
  Controller,
  Param,
  Patch,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { PanelUser } from "../auth/auth.types";
import { OportunidadService } from "./oportunidad.service";
import { ActualizarOportunidadDto } from "./dto/oportunidad.dto";

@Controller("oportunidades")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("asesor", "coordinador", "admin")
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class OportunidadController {
  constructor(private readonly oportunidades: OportunidadService) {}

  @Patch(":id")
  update(
    @CurrentUser() actor: PanelUser,
    @Param("id") id: string,
    @Body() dto: ActualizarOportunidadDto,
  ) {
    return this.oportunidades.update(actor, id, dto);
  }
}
