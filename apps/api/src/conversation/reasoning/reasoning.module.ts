import { Module } from "@nestjs/common";
import { ReasoningTraceService } from "./reasoning-trace.service";

@Module({
  providers: [ReasoningTraceService],
  exports: [ReasoningTraceService],
})
export class ReasoningModule {}
