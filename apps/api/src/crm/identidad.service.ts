import { Injectable, Optional } from "@nestjs/common";
import type { Cliente, TipoIdentificadorCliente } from "@prisma/client";
import type { VinculoClienteDto } from "@tres-cielos/shared";
import { PrismaService } from "../prisma/prisma.service";
import { phoneFingerprint, phoneMatchVariants } from "../conversation/telefono";
import type { IdentificadorCandidato } from "./cliente-identity";

const PHONE_TIPOS: TipoIdentificadorCliente[] = ["telefono", "wa_id"];

export function fingerprintsFromIdentifiers(
  identifiers: IdentificadorCandidato[],
): string[] {
  const fps = new Set<string>();
  for (const ident of identifiers) {
    if (ident.tipo === "telefono" || ident.tipo === "wa_id") {
      fps.add(ident.valorNormalizado);
    }
  }
  return [...fps];
}

export function searchFingerprints(q: string): string[] {
  const fp = phoneFingerprint(q);
  return fp ? phoneMatchVariants(fp) : [];
}

@Injectable()
export class IdentidadService {
  constructor(@Optional() private readonly prisma?: PrismaService) {}

  async findMatchingClienteIds(
    identifiers: IdentificadorCandidato[],
  ): Promise<string[]> {
    if (!this.prisma || identifiers.length === 0) return [];
    const ids = new Set<string>();
    const fps = fingerprintsFromIdentifiers(identifiers);
    const variants = fps.flatMap((fp) => phoneMatchVariants(fp));

    if (variants.length) {
      const byIdent = await this.prisma.identificadorCliente.findMany({
        where: {
          tipo: { in: PHONE_TIPOS },
          valorNormalizado: { in: variants },
        },
        select: { clienteId: true },
      });
      for (const row of byIdent) ids.add(row.clienteId);

      const byFicha = await this.prisma.cliente.findMany({
        where: { OR: fps.map((fp) => ({ telefono: { contains: fp } })) },
        select: { id: true },
      });
      for (const row of byFicha) ids.add(row.id);
    }

    for (const ident of identifiers) {
      const row = await this.prisma.identificadorCliente.findUnique({
        where: {
          tipo_valorNormalizado: {
            tipo: ident.tipo as TipoIdentificadorCliente,
            valorNormalizado: ident.valorNormalizado,
          },
        },
        select: { clienteId: true },
      });
      if (row) ids.add(row.clienteId);
    }

    return [...ids];
  }

  async pickCanonical(clienteIds: string[]): Promise<Cliente | null> {
    if (!this.prisma || clienteIds.length === 0) return null;
    const unique = [...new Set(clienteIds)];
    const rows = await this.prisma.cliente.findMany({
      where: { id: { in: unique } },
      orderBy: [
        { primerContactoEn: "asc" },
        { creadoEn: "asc" },
        { id: "asc" },
      ],
    });
    return rows[0] ?? null;
  }

  async vinculosFor(clienteId: string): Promise<VinculoClienteDto[]> {
    if (!this.prisma) return [];
    const own = await this.prisma.identificadorCliente.findMany({
      where: { clienteId },
    });
    const fps = own
      .filter((i) => i.tipo === "telefono" || i.tipo === "wa_id")
      .map((i) => i.valorNormalizado);
    const variants = fps.flatMap((fp) => phoneMatchVariants(fp));
    const otherIds = new Set<string>();

    if (variants.length) {
      const rows = await this.prisma.identificadorCliente.findMany({
        where: {
          tipo: { in: PHONE_TIPOS },
          valorNormalizado: { in: variants },
          clienteId: { not: clienteId },
        },
        select: { clienteId: true },
      });
      for (const row of rows) otherIds.add(row.clienteId);
    }

    for (const ident of own) {
      const clash = await this.prisma.identificadorCliente.findMany({
        where: {
          tipo: ident.tipo,
          valorNormalizado: ident.valorNormalizado,
          clienteId: { not: clienteId },
        },
        select: { clienteId: true },
      });
      for (const row of clash) otherIds.add(row.clienteId);
    }

    const dups = await this.prisma.interaccion.findMany({
      where: {
        OR: [{ clienteId }, { clienteId: { in: [...otherIds] } }],
        tipo: "posible_duplicado",
      },
      select: { clienteId: true, payload: true },
    });
    for (const dup of dups) {
      const payload = dup.payload as { otroClienteId?: string } | null;
      if (payload?.otroClienteId && payload.otroClienteId !== clienteId) {
        otherIds.add(payload.otroClienteId);
      }
      if (dup.clienteId !== clienteId) otherIds.add(dup.clienteId);
    }

    if (otherIds.size === 0) return [];

    const allIds = [clienteId, ...otherIds];
    const clientes = await this.prisma.cliente.findMany({
      where: { id: { in: allIds } },
      orderBy: [{ primerContactoEn: "asc" }, { creadoEn: "asc" }],
    });
    const canonicalId = clientes[0]?.id;
    return clientes
      .filter((c) => c.id !== clienteId)
      .map((c) => ({
        clienteId: c.id,
        relacion:
          c.id === canonicalId && clienteId !== canonicalId
            ? ("canonico" as const)
            : ("posible_duplicado" as const),
        nombre: c.nombre,
        telefono: c.telefono,
        primerContactoEn: c.primerContactoEn.toISOString(),
      }));
  }

  async clienteIdsConDuplicado(clienteIds: string[]): Promise<Set<string>> {
    const flagged = new Set<string>();
    if (!this.prisma || clienteIds.length === 0) return flagged;

    const idents = await this.prisma.identificadorCliente.findMany({
      where: {
        clienteId: { in: clienteIds },
        tipo: { in: PHONE_TIPOS },
      },
      select: { clienteId: true, valorNormalizado: true },
    });
    const variants = [
      ...new Set(
        idents.flatMap((i) => phoneMatchVariants(i.valorNormalizado)),
      ),
    ];
    if (variants.length) {
      const related = await this.prisma.identificadorCliente.findMany({
        where: {
          tipo: { in: PHONE_TIPOS },
          valorNormalizado: { in: variants },
        },
        select: { clienteId: true, valorNormalizado: true },
      });
      const byFp = new Map<string, Set<string>>();
      for (const row of related) {
        const fp = phoneFingerprint(row.valorNormalizado) ?? row.valorNormalizado;
        const set = byFp.get(fp) ?? new Set<string>();
        set.add(row.clienteId);
        byFp.set(fp, set);
      }
      for (const ident of idents) {
        const fp =
          phoneFingerprint(ident.valorNormalizado) ?? ident.valorNormalizado;
        if ((byFp.get(fp)?.size ?? 0) > 1) flagged.add(ident.clienteId);
      }
    }

    const dups = await this.prisma.interaccion.findMany({
      where: {
        clienteId: { in: clienteIds },
        tipo: "posible_duplicado",
      },
      select: { clienteId: true },
    });
    for (const d of dups) flagged.add(d.clienteId);
    return flagged;
  }
}
