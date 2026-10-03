import type { Canal as PrismaCanal, EstadoAtencion } from "@prisma/client";
import {
  normalizeTelefono,
  phoneFingerprint,
} from "../conversation/telefono";
import type { CamposCapturados, EstadoBot } from "../conversation/types";

export type TipoIdentificador =
  | "telefono"
  | "wa_id"
  | "meta_psid"
  | "ig_scoped_id"
  | "email"
  | "sandbox_thread";

export interface IdentificadorCandidato {
  tipo: TipoIdentificador;
  valor: string;
  valorNormalizado: string;
}

export interface PerfilCanalLite {
  nombre?: string | null;
  psid?: string | null;
  waId?: string | null;
}

export function mapCanalCrm(canal: string): PrismaCanal {
  const c = canal.toLowerCase();
  if (c === "whatsapp") return "whatsapp";
  if (c === "instagram") return "instagram";
  if (c === "facebook" || c === "messenger") return "facebook";
  return "sandbox";
}

export function mapEstadoAtencion(estadoBot: EstadoBot): EstadoAtencion {
  if (estadoBot === "escalado") return "escalado";
  if (estadoBot === "humano") return "en_atencion";
  return "bot_activo";
}

export function normalizeIdentificador(
  tipo: TipoIdentificador,
  raw: string | null | undefined,
): IdentificadorCandidato | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (tipo === "telefono" || tipo === "wa_id") {
    const fp = phoneFingerprint(trimmed);
    const tel = normalizeTelefono(trimmed);
    if (!fp || !tel) return null;
    return { tipo, valor: tel, valorNormalizado: fp };
  }
  if (tipo === "email") {
    const email = trimmed.toLowerCase();
    if (!email.includes("@")) return null;
    return { tipo, valor: email, valorNormalizado: email };
  }
  const valor = tipo === "sandbox_thread" ? trimmed.toLowerCase() : trimmed;
  return { tipo, valor, valorNormalizado: valor };
}

export function identifiersFromThread(input: {
  canal: string;
  externalThreadId: string;
  perfil?: PerfilCanalLite | null;
  campos?: CamposCapturados;
}): IdentificadorCandidato[] {
  const canal = mapCanalCrm(input.canal);
  const thread = input.externalThreadId.trim();
  const found = new Map<string, IdentificadorCandidato>();

  const add = (c: IdentificadorCandidato | null) => {
    if (!c) return;
    found.set(`${c.tipo}:${c.valorNormalizado}`, c);
  };

  if (canal === "whatsapp") {
    const wa = thread.match(/^wa:(.+)$/i)?.[1] ?? input.perfil?.waId ?? thread;
    add(normalizeIdentificador("wa_id", wa));
    add(normalizeIdentificador("telefono", wa));
  } else if (canal === "facebook") {
    add(normalizeIdentificador("meta_psid", input.perfil?.psid ?? thread));
  } else if (canal === "instagram") {
    add(
      normalizeIdentificador("ig_scoped_id", input.perfil?.psid ?? thread),
    );
  } else {
    add(normalizeIdentificador("sandbox_thread", thread));
    if (phoneFingerprint(thread)?.length === 10) {
      add(normalizeIdentificador("telefono", thread));
    }
  }

  add(normalizeIdentificador("wa_id", input.perfil?.waId ?? null));
  add(normalizeIdentificador("telefono", input.campos?.telefono ?? null));
  add(normalizeIdentificador("email", input.campos?.email ?? null));
  add(normalizeIdentificador("meta_psid", input.perfil?.psid ?? null));

  return [...found.values()];
}
