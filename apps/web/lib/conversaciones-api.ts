import type { BandejaItem, BriefCardDto } from "@tres-cielos/shared";
import { apiFetch, readJson } from "./http";

export async function listBandeja(cola?: "comercial" | "atencion_general"): Promise<{
  data: BandejaItem[];
}> {
  const qs = cola ? `?cola=${cola}` : "";
  const res = await apiFetch(`/conversaciones${qs}`);
  return readJson(res);
}

export async function getConversacion(id: string): Promise<{
  id: string;
  estadoBot: string;
  brief: BriefCardDto;
  cola?: string | null;
  asesorLockId?: string | null;
  slaVenceEn?: string | null;
}> {
  const res = await apiFetch(`/conversaciones/${id}`);
  return readJson(res);
}

export async function tomarControl(
  id: string,
  motivo?: string,
): Promise<{ id: string; estadoBot: string }> {
  const res = await apiFetch(`/conversaciones/${id}/tomar-control`, {
    method: "POST",
    body: JSON.stringify({ motivo }),
  });
  return readJson(res);
}

export async function devolverABot(
  id: string,
  motivo: "asesor_libera" | "sla_vencido" | "cola_general_resuelta",
): Promise<{ id: string; estadoBot: string }> {
  const res = await apiFetch(`/conversaciones/${id}/devolver-a-bot`, {
    method: "POST",
    body: JSON.stringify({ motivo }),
  });
  return readJson(res);
}
