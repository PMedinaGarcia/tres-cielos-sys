import { Global, Module } from "@nestjs/common";
import { PanelRealtimeService } from "./panel-realtime.service";

@Global()
@Module({
  providers: [PanelRealtimeService],
  exports: [PanelRealtimeService],
})
export class PanelRealtimeModule {}
