import { ConversationStoreService } from "./conversation-store.service";
import { flowConfig } from "../__tests__/flow-config";
import type { PrismaService } from "../../prisma/prisma.service";

describe("ConversationStoreService hidratación Prisma", () => {
  it("reconstruye paso y campos desde el expediente cuando el mapa está vacío", async () => {
    const findUnique = jest.fn(async () => ({
      id: "conv-db",
      clienteId: "cli-1",
      oportunidadId: "opp-db",
      canal: "whatsapp",
      externalThreadId: "wa:52155",
      estadoBot: "activo",
      pasoGuion: "aforo_inversion",
      camposCapturados: {
        nombre: "Ana",
        tipoEvento: "boda",
        aforo: 120,
        rangoInversion: "por_definir",
      },
      paqueteTentativoId: null,
      ultimaRuta: "guion",
      motivoHandoff: null,
      escaladoEn: null,
      encajeEconomico: "no_confirmado",
      rutaComercial: null,
      creadoEn: new Date("2026-09-01T00:00:00.000Z"),
      actualizadoEn: new Date("2026-09-01T00:00:00.000Z"),
      oportunidad: {
        calificacion: "calificado",
        listoParaCotizar: true,
        briefJson: { version: 2, actualizadoPor: "bot" },
      },
      mensajes: [
        {
          id: "msg-1",
          direccion: "entrante",
          autor: "prospecto",
          contenido: "Hola",
          creadoEn: new Date("2026-09-01T00:00:00.000Z"),
          externalMessageId: "ext-1",
          ruta: null,
          consumeCupo: false,
          plantillaUtilityId: null,
        },
      ],
    }));
    const prisma = { conversacion: { findUnique } } as unknown as PrismaService;
    const prev = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "postgresql://test";
    const store = new ConversationStoreService(prisma, flowConfig("v2"));
    const conv = await store.resolveOrCreate({
      canal: "whatsapp",
      externalThreadId: "wa:52155",
    });
    expect(conv.id).toBe("conv-db");
    expect(conv.oportunidadId).toBe("opp-db");
    expect(conv.pasoGuion).toBe("aforo_inversion");
    expect(conv.camposCapturados.nombre).toBe("Ana");
    expect(conv.mensajes).toHaveLength(1);
    expect(conv.calificado).toBe(true);
    expect(conv.listoParaCotizar).toBe(true);
    expect(conv.brief.version).toBe(2);
    expect(findUnique).toHaveBeenCalled();
    process.env.DATABASE_URL = prev;
  });
});
