import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { PanelUser } from "../auth/auth.types";
import { ClienteService } from "./cliente.service";
import {
  ActualizarClienteDto,
  CrearNotaClienteDto,
  HistorialQueryDto,
  ListClientesQueryDto,
  ReemplazarTagsDto,
  TimelineQueryDto,
} from "./dto/cliente.dto";

@Controller("clientes")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("asesor", "coordinador", "admin")
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class ClienteController {
  constructor(private readonly clientes: ClienteService) {}

  @Get()
  list(@CurrentUser() actor: PanelUser, @Query() query: ListClientesQueryDto) {
    return this.clientes.list(actor, query);
  }

  @Get(":id/timeline")
  timeline(
    @CurrentUser() actor: PanelUser,
    @Param("id") id: string,
    @Query() query: TimelineQueryDto,
  ) {
    return this.clientes.timeline(actor, id, query.page ?? 1, query.pageSize ?? 50);
  }

  @Get(":id/historial")
  historial(
    @CurrentUser() actor: PanelUser,
    @Param("id") id: string,
    @Query() query: HistorialQueryDto,
  ) {
    return this.clientes.historial(actor, id, query);
  }

  @Get(":id")
  get(@CurrentUser() actor: PanelUser, @Param("id") id: string) {
    return this.clientes.getById(actor, id);
  }

  @Patch(":id")
  update(
    @CurrentUser() actor: PanelUser,
    @Param("id") id: string,
    @Body() dto: ActualizarClienteDto,
  ) {
    return this.clientes.update(actor, id, dto);
  }

  @Post(":id/notas")
  addNota(
    @CurrentUser() actor: PanelUser,
    @Param("id") id: string,
    @Body() dto: CrearNotaClienteDto,
  ) {
    return this.clientes.addNota(actor, id, dto);
  }

  @Put(":id/tags")
  replaceTags(
    @CurrentUser() actor: PanelUser,
    @Param("id") id: string,
    @Body() dto: ReemplazarTagsDto,
  ) {
    return this.clientes.replaceTags(actor, id, dto);
  }
}
