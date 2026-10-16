import type {
  CompletarAdjuntoBandejaResponse,
  CompletarMultipartRequest,
  PrepararAdjuntoBandejaResponse,
} from "@tres-cielos/shared";
import { API_URL, apiFetch, readJson } from "./http";

export async function prepararAdjunto(
  conversacionId: string,
  input: { nombreOriginal: string; mimeType: string; bytes: number },
): Promise<PrepararAdjuntoBandejaResponse> {
  const res = await apiFetch(`/conversaciones/${conversacionId}/adjuntos/preparar`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return readJson(res);
}

export async function completarAdjuntoPut(
  conversacionId: string,
  uploadId: string,
): Promise<CompletarAdjuntoBandejaResponse> {
  const res = await apiFetch(
    `/conversaciones/${conversacionId}/adjuntos/${uploadId}/completar`,
    { method: "POST" },
  );
  return readJson(res);
}

export async function completarAdjuntoMultipart(
  conversacionId: string,
  uploadId: string,
  body: CompletarMultipartRequest,
): Promise<CompletarAdjuntoBandejaResponse> {
  const res = await apiFetch(
    `/conversaciones/${conversacionId}/adjuntos/${uploadId}/completar-multipart`,
    { method: "POST", body: JSON.stringify(body) },
  );
  return readJson(res);
}

export async function subirArchivoBandeja(
  conversacionId: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<CompletarAdjuntoBandejaResponse> {
  const prep = await prepararAdjunto(conversacionId, {
    nombreOriginal: file.name,
    mimeType: file.type || "application/octet-stream",
    bytes: file.size,
  });

  if (prep.method === "put" && prep.uploadUrl) {
    const useBinario =
      prep.uploadUrl.includes("/binario") ||
      prep.uploadUrl.startsWith("memory://");
    if (useBinario) {
      const res = await apiFetch(
        `/conversaciones/${conversacionId}/adjuntos/${prep.uploadId}/binario`,
        {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/octet-stream" },
          body: file,
        },
      );
      if (!res.ok) throw new Error("SUBIDA_FALLIDA");
      onProgress?.(100);
      return readJson(res);
    }
    const put = await fetch(prep.uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type || "application/octet-stream" },
    });
    if (!put.ok) throw new Error("SUBIDA_FALLIDA");
    onProgress?.(100);
    return completarAdjuntoPut(conversacionId, prep.uploadId);
  }

  const mp = prep.multipart;
  if (!mp) throw new Error("MULTIPART_NO_DISPONIBLE");
  const parts: CompletarMultipartRequest["parts"] = [];
  let offset = 0;
  for (let i = 0; i < mp.partUrls.length; i++) {
    const end = Math.min(offset + mp.partSize, file.size);
    const chunk = file.slice(offset, end);
    const put = await fetch(mp.partUrls[i], { method: "PUT", body: chunk });
    if (!put.ok) throw new Error("PARTE_FALLIDA");
    const etag = put.headers.get("etag") ?? put.headers.get("ETag");
    if (!etag) throw new Error("ETAG_FALTANTE");
    parts.push({ partNumber: i + 1, etag });
    offset = end;
    onProgress?.(Math.round((offset / file.size) * 100));
  }
  return completarAdjuntoMultipart(conversacionId, prep.uploadId, { parts });
}
