import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { PanelUser } from "../auth/auth.types";
import { UsersService } from "./users.service";
import { CreateUserDto, SetCredentialsDto, UpdateUserDto } from "./dto/users.dto";

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get("usuarios")
  async list(@CurrentUser() actor: PanelUser) {
    return { data: await this.users.list(actor.orgId) };
  }

  @Post("usuarios")
  async create(@CurrentUser() actor: PanelUser, @Body() dto: CreateUserDto) {
    return { data: await this.users.create(actor, dto) };
  }

  @Patch("usuarios/:id")
  async update(
    @CurrentUser() actor: PanelUser,
    @Param("id") id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return { data: await this.users.update(actor, id, dto) };
  }

  @Post("usuarios/:id/credenciales")
  @HttpCode(204)
  async credentials(
    @CurrentUser() actor: PanelUser,
    @Param("id") id: string,
    @Body() dto: SetCredentialsDto,
  ) {
    await this.users.setCredentials(actor, id, dto);
  }

  @Get("sedes")
  async sedes(@CurrentUser() actor: PanelUser) {
    return { data: await this.users.listSedes(actor.orgId) };
  }
}
