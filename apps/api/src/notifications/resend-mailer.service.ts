import { Injectable, Logger } from "@nestjs/common";
import { Resend } from "resend";

export const RESEND_FROM_DEFAULT = "Tres Cielos <avisos@trescielosbot.org>";

export interface CorreoSaliente {
  to: string[];
  bcc?: string[];
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
}

/**
 * Envío transaccional. Sin RESEND_API_KEY no hace nada:
 * el webhook de WhatsApp no debe depender del correo.
 */
@Injectable()
export class ResendMailerService {
  private readonly logger = new Logger(ResendMailerService.name);

  async send(input: CorreoSaliente): Promise<{ ok: boolean }> {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    if (!apiKey) {
      this.logger.warn("RESEND_API_KEY ausente; el aviso por correo no se envió");
      return { ok: false };
    }
    const from = process.env.RESEND_FROM?.trim() || RESEND_FROM_DEFAULT;
    try {
      const resend = new Resend(apiKey);
      const { error } = await resend.emails.send(
        {
          from,
          to: input.to,
          bcc: input.bcc,
          subject: input.subject,
          html: input.html,
          text: input.text,
        },
        { idempotencyKey: input.idempotencyKey },
      );
      if (error) {
        this.logger.error(`Resend rechazó el aviso: ${error.message}`);
        return { ok: false };
      }
      return { ok: true };
    } catch (err) {
      this.logger.error(
        `No se pudo enviar el aviso: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { ok: false };
    }
  }
}
