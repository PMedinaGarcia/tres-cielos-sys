import { Module } from "@nestjs/common";
import { CrmCalificacionService } from "./calificacion.service";
import { ExpedientePersistService } from "./expediente-persist.service";

@Module({
  providers: [CrmCalificacionService, ExpedientePersistService],
  exports: [CrmCalificacionService, ExpedientePersistService],
})
export class CrmModule {}
