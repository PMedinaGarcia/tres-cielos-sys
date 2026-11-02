import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { NotificationsModule } from "../notifications/notifications.module";
import { AssignmentController } from "./assignment.controller";
import { AssignmentEngine } from "./assignment-engine.service";

@Module({
  imports: [AuthModule, NotificationsModule],
  controllers: [AssignmentController],
  providers: [AssignmentEngine],
  exports: [AssignmentEngine],
})
export class AssignmentModule {}
