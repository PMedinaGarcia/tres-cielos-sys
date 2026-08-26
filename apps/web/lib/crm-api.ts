import type {
  ActualizarClienteRequest,
  ActualizarOportunidadRequest,
  ClienteDetail,
  ClienteListItem,
  CrearNotaClienteRequest,
  HistorialItemDto,
  OportunidadResumenDto,
  ReemplazarTagsRequest,
} from "@tres-cielos/shared";
import { apiFetch, readJson } from "./http";

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
}

export async function listClientes(query: {
  q?: string;
  estadoAtencion?: string;
  sinAsignar?: boolean;
  tag?: string;
  cola?: string;
  tipoEvento?: string;
  etapaCotizacion?: string;
  visitaEstado?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ data: ClienteListItem[]; meta: PageMeta }> {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.estadoAtencion) params.set("estadoAtencion", query.estadoAtencion);
  if (query.sinAsignar) params.set("sinAsignar", "true");
  if (query.tag) params.set("tag", query.tag);
  if (query.cola) params.set("cola", query.cola);
  if (query.tipoEvento) params.set("tipoEvento", query.tipoEvento);
  if (query.etapaCotizacion) params.set("etapaCotizacion", query.etapaCotizacion);
  if (query.visitaEstado) params.set("visitaEstado", query.visitaEstado);
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  const qs = params.toString();
  const res = await apiFetch(`/clientes${qs ? `?${qs}` : ""}`);
  return readJson(res);
}

export async function getCliente(id: string): Promise<ClienteDetail> {
  const res = await apiFetch(`/clientes/${id}`);
  const json = await readJson<{ data: ClienteDetail }>(res);
  return json.data;
}

export async function patchCliente(
  id: string,
  body: ActualizarClienteRequest,
): Promise<ClienteDetail> {
  const res = await apiFetch(`/clientes/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  const json = await readJson<{ data: ClienteDetail }>(res);
  return json.data;
}

export async function patchOportunidad(
  id: string,
  body: ActualizarOportunidadRequest,
): Promise<OportunidadResumenDto> {
  const res = await apiFetch(`/oportunidades/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
  const json = await readJson<{ data: OportunidadResumenDto }>(res);
  return json.data;
}

export async function addNotaCliente(
  id: string,
  body: CrearNotaClienteRequest,
): Promise<{ id: string; autorId: string; cuerpo: string; creadoEn: string }> {
  const res = await apiFetch(`/clientes/${id}/notas`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  const json = await readJson<{ data: { id: string; autorId: string; cuerpo: string; creadoEn: string } }>(res);
  return json.data;
}

export async function replaceTagsCliente(
  id: string,
  body: ReemplazarTagsRequest,
): Promise<ClienteDetail> {
  const res = await apiFetch(`/clientes/${id}/tags`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
  const json = await readJson<{ data: ClienteDetail }>(res);
  return json.data;
}

export async function getClienteHistorial(
  id: string,
  query: { page?: number; pageSize?: number; tipo?: string } = {},
): Promise<{ data: HistorialItemDto[]; meta: PageMeta }> {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.pageSize) params.set("pageSize", String(query.pageSize));
  if (query.tipo) params.set("tipo", query.tipo);
  const qs = params.toString();
  const res = await apiFetch(
    `/clientes/${id}/historial${qs ? `?${qs}` : ""}`,
  );
  return readJson(res);
}
