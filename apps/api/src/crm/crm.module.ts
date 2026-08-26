import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AssignmentModule } from "../assignment/assignment.module";
import { CrmCalificacionService } from "./calificacion.service";
import { ExpedientePersistService } from "./expediente-persist.service";
import { ClienteService } from "./cliente.service";
import { ClienteController } from "./cliente.controller";
import { OportunidadController } from "./oportunidad.controller";
import { IdentidadService } from "./identidad.service";
import { OportunidadService } from "./oportunidad.service";

@Module({
  imports: [AuthModule, AssignmentModule],
  controllers: [ClienteController, OportunidadController],
  providers: [
    CrmCalificacionService,
    ExpedientePersistService,
    ClienteService,
    OportunidadService,
    IdentidadService,
  ],
  exports: [
    CrmCalificacionService,
    ExpedientePersistService,
    ClienteService,
    IdentidadService,
  ],
})
export class CrmModule {}
