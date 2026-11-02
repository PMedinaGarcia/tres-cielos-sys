import { Injectable, Logger, Optional } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ResendMailerService } from "./resend-mailer.service";

/** Ventana para no repetir el aviso de equipo en el mismo hilo. */
const EQUIPO_VENTANA_MS = 2 * 60 * 1000;
const IDEMPOTENCIA_MS = 24 * 60 * 60 * 1000;
const EXTRACTO_MAX = 500;

export interface AvisoCorreo {
  conversacionId: string;
  canal?: string;
  externalMessageId?: string;
  texto?: string;
  motivo?: string;
  sandbox?: boolean;
}

const MOTIVOS: Record<string, string> = {
  solicitud_usuario: "Pidió hablar con un asesor",
  rerank_bajo: "La respuesta automática no fue suficiente",
  sin_catalogo: "No hay paquete en catálogo",
  sin_cita_rag: "No hay información para responder",
  conflicto: "Conflicto en la conversación",
  queja: "Queja",
  descuento_fuera_catalogo: "Pidió un descuento fuera de catálogo",
  sede_no_cubierta: "La sede no está cubierta",
  ambiguedad: "La solicitud no quedó clara",
  adjunto_no_soportado: "Envió un archivo que no podemos leer",
  material_ocr_tarifas: "Envió material de tarifas",
  proveedor_ia: "Fallo técnico del asistente",
  cupo_ia: "Se alcanzó el límite de uso",
  otro: "Requiere atención",
  calificado: "El lead quedó calificado",
  listo_para_cotizar: "El lead está listo para cotizar",
  sin_disponibles: "No hay asesores disponibles",
  todos_en_tope: "Los asesores llegaron a su tope",
  dueno_inactivo: "El asesor anterior ya no puede recibir leads",
  sla_vencido: "Se venció la ventana de contacto",
};

type ConvAviso = {
  sede: string | null;
  asesorLockId: string | null;
  cliente: {
    id: string;
    nombre: string | null;
    telefono: string | null;
    nombrePerfilCanal: string | null;
    asesorAsignadoId: string | null;
    sedeInteresId: string | null;
  };
  oportunidad: { asesorAsignadoId: string | null } | null;
};

/**
 * Avisa por correo cuando un mensaje ya es de un asesor.
 * Con dueño, un correo por mensaje. Sin dueño, a los coordinadores de la sede.
 */
@Injectable()
export class AsesorAlertService {
  private readonly logger = new Logger(AsesorAlertService.name);
  private readonly enviados = new Map<string, number>();
  private readonly equipoAvisadoEn = new Map<string, number>();

  constructor(
    private readonly mailer: ResendMailerService,
    @Optional() private readonly prisma?: PrismaService,
  ) {}

  async avisar(input: AvisoCorreo): Promise<void> {
    try {
      await this.enviar(input);
    } catch (err) {
      this.logger.error(
        `Aviso no enviado conv=${input.conversacionId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }

  private async enviar(input: AvisoCorreo): Promise<void> {
    if (input.sandbox) return;
    if (!input.canal || !input.externalMessageId) return;
    const clave = `mensaje:${input.canal}:${input.externalMessageId}`;
    if (this.yaEnviado(clave)) return;
    if (!this.prisma) {
      this.logger.warn("Sin base de datos; el aviso por correo no se envió");
      return;
    }

    const conv = await this.prisma.conversacion.findUnique({
      where: { id: input.conversacionId },
      select: {
        sede: true,
        asesorLockId: true,
        cliente: {
          select: {
            id: true,
            nombre: true,
            telefono: true,
            nombrePerfilCanal: true,
            asesorAsignadoId: true,
            sedeInteresId: true,
          },
        },
        oportunidad: { select: { asesorAsignadoId: true } },
      },
    });
    if (!conv?.cliente) {
      this.logger.warn(`Hilo sin ficha conv=${input.conversacionId}`);
      return;
    }

    const destino = await this.destinatarios(conv);
    if (!destino) return;

    if (destino.modo === "equipo") {
      const ultimo = this.equipoAvisadoEn.get(input.conversacionId) ?? 0;
      if (Date.now() - ultimo < EQUIPO_VENTANA_MS) {
        this.marcar(clave);
        return;
      }
    }

    const cuerpo = armarCuerpo({
      nombre: nombreProspecto(conv),
      telefono: conv.cliente.telefono,
      texto: input.texto ?? "",
      motivo: input.motivo,
      enlace: enlaceBandeja(conv.cliente.id),
    });
    const [primero, ...resto] = destino.emails;
    if (!primero) return;

    const ok = await this.mailer.send({
      to: [primero],
      ...(resto.length > 0 ? { bcc: resto } : {}),
      subject: `Nuevo mensaje de ${cuerpo.nombreCorto}`,
      html: cuerpo.html,
      text: cuerpo.text,
      idempotencyKey: clave,
    });
    if (!ok.ok) return;

    this.marcar(clave);
    if (destino.modo === "equipo") {
      this.equipoAvisadoEn.set(input.conversacionId, Date.now());
    }
    this.logger.log(
      `Aviso conv=${input.conversacionId} modo=${destino.modo} destinatarios=${destino.emails.length}`,
    );
  }

  private async destinatarios(
    conv: ConvAviso,
  ): Promise<{ modo: "dueno" | "equipo"; emails: string[] } | null> {
    const ids = [
      conv.asesorLockId,
      conv.cliente.asesorAsignadoId,
      conv.oportunidad?.asesorAsignadoId ?? null,
    ].filter((id): id is string => Boolean(id));

    for (const id of [...new Set(ids)]) {
      const dueno = await this.prisma!.usuario.findFirst({
        where: { id, activo: true },
        select: { email: true },
      });
      const email = limpiaEmail(dueno?.email);
      if (email) return { modo: "dueno", emails: [email] };
    }

    const sedeId = conv.cliente.sedeInteresId ?? conv.sede ?? null;
    const copia = await this.correosCoordinadores(sedeId);
    if (copia.length === 0) {
      this.logger.warn("No hay coordinador activo para el aviso");
      return null;
    }
    return { modo: "equipo", emails: copia };
  }

  /** Un solo destinatario: el asesor que acaba de recibir el lead. */
  async avisarAsignacion(input: {
    conversacionId: string;
    asesorId: string;
    clienteId: string | null;
  }): Promise<void> {
    const clave = `asignacion:${input.conversacionId}:${input.asesorId}`;
    if (this.yaEnviado(clave)) return;
    if (!this.prisma) return;
    const usuario = await this.prisma.usuario.findFirst({
      where: { id: input.asesorId, activo: true },
      select: { email: true },
    });
    const email = limpiaEmail(usuario?.email);
    if (!email) return;
    const conv = await this.ficha(input.conversacionId);
    const cuerpo = armarCuerpo({
      nombre: conv ? nombreProspecto(conv) : "un prospecto",
      telefono: conv?.cliente.telefono ?? null,
      texto: "",
      motivo: "calificado",
      enlace: enlaceBandeja(input.clienteId ?? conv?.cliente.id ?? ""),
    });
    const ok = await this.mailer.send({
      to: [email],
      subject: `Lead asignado: ${cuerpo.nombreCorto}`,
      html: cuerpo.html,
      text: cuerpo.text,
      idempotencyKey: clave,
    });
    if (ok.ok) this.marcar(clave);
  }

  /** Cola sin dueño: coordinadores de la sede, nunca el equipo completo. */
  async avisarCola(input: {
    conversacionId: string;
    sedeId: string;
    motivo: string;
    clienteId: string | null;
  }): Promise<void> {
    const clave = `cola:${input.conversacionId}:${input.motivo}`;
    if (this.yaEnviado(clave)) return;
    if (!this.prisma) return;
    const emails = await this.correosCoordinadores(input.sedeId);
    const [primero, ...resto] = emails;
    if (!primero) return;
    const conv = await this.ficha(input.conversacionId);
    const cuerpo = armarCuerpo({
      nombre: conv ? nombreProspecto(conv) : "un prospecto",
      telefono: conv?.cliente.telefono ?? null,
      texto: "",
      motivo: input.motivo,
      enlace: enlaceBandeja(input.clienteId ?? conv?.cliente.id ?? ""),
    });
    const ok = await this.mailer.send({
      to: [primero],
      ...(resto.length > 0 ? { bcc: resto } : {}),
      subject: `Lead sin asesor: ${cuerpo.nombreCorto}`,
      html: cuerpo.html,
      text: cuerpo.text,
      idempotencyKey: clave,
    });
    if (ok.ok) this.marcar(clave);
  }

  private async ficha(conversacionId: string): Promise<ConvAviso | null> {
    return this.prisma!.conversacion.findUnique({
      where: { id: conversacionId },
      select: {
        sede: true,
        asesorLockId: true,
        cliente: {
          select: {
            id: true,
            nombre: true,
            telefono: true,
            nombrePerfilCanal: true,
            asesorAsignadoId: true,
            sedeInteresId: true,
          },
        },
        oportunidad: { select: { asesorAsignadoId: true } },
      },
    });
  }

  private async correosCoordinadores(sedeId: string | null): Promise<string[]> {
    const deLaSede = await this.prisma!.usuario.findMany({
      where: {
        rol: "coordinador",
        activo: true,
        ...(sedeId ? { sedes: { some: { sedeId } } } : {}),
      },
      select: { email: true },
    });
    const emails = unicos(deLaSede.map((u) => u.email));
    if (emails.length > 0 || !sedeId) return emails;
    const todos = await this.prisma!.usuario.findMany({
      where: { rol: "coordinador", activo: true },
      select: { email: true },
    });
    return unicos(todos.map((u) => u.email));
  }

  private yaEnviado(clave: string): boolean {
    this.purgar();
    return this.enviados.has(clave);
  }

  private marcar(clave: string): void {
    this.enviados.set(clave, Date.now());
  }

  private purgar(): void {
    const corte = Date.now() - IDEMPOTENCIA_MS;
    for (const [clave, en] of this.enviados) {
      if (en < corte) this.enviados.delete(clave);
    }
  }
}

function nombreProspecto(conv: ConvAviso): string {
  return (
    conv.cliente.nombre?.trim() ||
    conv.cliente.nombrePerfilCanal?.trim() ||
    "un prospecto"
  );
}

function enlaceBandeja(clienteId: string): string | null {
  const base = (process.env.PANEL_PUBLIC_URL ?? "").trim().replace(/\/$/, "");
  if (!base || !clienteId) return null;
  return `${base}/bandeja?c=${encodeURIComponent(clienteId)}`;
}

function limpiaEmail(email: string | null | undefined): string | null {
  const valor = email?.trim();
  if (!valor || !valor.includes("@")) return null;
  return valor;
}

function unicos(emails: Array<string | null | undefined>): string[] {
  const vistos = new Set<string>();
  const salida: string[] = [];
  for (const crudo of emails) {
    const email = limpiaEmail(crudo);
    if (!email) continue;
    const llave = email.toLowerCase();
    if (vistos.has(llave)) continue;
    vistos.add(llave);
    salida.push(email);
    if (salida.length >= 49) break;
  }
  return salida;
}

function armarCuerpo(input: {
  nombre: string;
  telefono: string | null;
  texto: string;
  motivo?: string;
  enlace: string | null;
}): { html: string; text: string; nombreCorto: string } {
  const nombre = input.nombre;
  const nombreCorto = nombre.length > 80 ? `${nombre.slice(0, 77)}…` : nombre;
  const extracto = recortar(input.texto);
  const motivo = input.motivo ? (MOTIVOS[input.motivo] ?? "Requiere atención") : null;
  const telefono = input.telefono?.trim() || null;

  const lineas = [
    `Tienes un mensaje nuevo de ${nombre}.`,
    telefono ? `Teléfono: ${telefono}` : null,
    motivo ? `Motivo: ${motivo}` : null,
    "",
    extracto,
    input.enlace ? "" : null,
    input.enlace ? `Abrir en la bandeja: ${input.enlace}` : null,
  ].filter((l): l is string => l !== null);

  const htmlPartes = [
    `<p>Tienes un mensaje nuevo de <strong>${esc(nombre)}</strong>.</p>`,
    telefono ? `<p>Teléfono: ${esc(telefono)}</p>` : "",
    motivo ? `<p>Motivo: ${esc(motivo)}</p>` : "",
    `<blockquote style="margin:16px 0;padding-left:12px;border-left:3px solid #b45309">${esc(extracto)}</blockquote>`,
    input.enlace
      ? `<p><a href="${esc(input.enlace)}">Abrir en la bandeja</a></p>`
      : "",
  ];

  return {
    nombreCorto,
    text: lineas.join("\n"),
    html: `<div style="font-family:Georgia,serif;color:#1c1917;line-height:1.5">${htmlPartes.join("")}</div>`,
  };
}

function recortar(texto: string): string {
  const limpio = texto.trim();
  if (!limpio) return "(sin texto)";
  if (limpio.length <= EXTRACTO_MAX) return limpio;
  return `${limpio.slice(0, EXTRACTO_MAX - 3)}…`;
}

function esc(valor: string): string {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
