import { Module } from "@nestjs/common";
import { HandoffService } from "./handoff.service";
import { ConversationStubsModule } from "../stubs/conversation-stubs.module";

@Module({
  imports: [ConversationStubsModule],
  providers: [HandoffService],
  exports: [HandoffService],
})
export class HandoffModule {}
