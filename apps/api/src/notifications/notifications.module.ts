import { Module } from "@nestjs/common";
import { AsesorAlertService } from "./asesor-alert.service";
import { NotificationsService } from "./notifications.service";
import { ResendMailerService } from "./resend-mailer.service";

@Module({
  providers: [ResendMailerService, AsesorAlertService, NotificationsService],
  exports: [NotificationsService, AsesorAlertService],
})
export class NotificationsModule {}
