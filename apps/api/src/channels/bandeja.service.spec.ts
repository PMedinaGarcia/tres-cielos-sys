import { HttpException } from "@nestjs/common";
import type { PanelUser } from "../auth/auth.types";
import type { ConversacionState } from "../conversation/types";
import { BandejaService } from "./bandeja.service";

const user: PanelUser = {
  userId: "asesor-1",
  email: "a@t.local",
  name: "Ana",
  role: "asesor",
  sedeIds: [],
  orgId: "org-1",
  flags: { activo: true, disponible: true },
};

function hilo(overrides: Record<string, unknown> = {}) {
  return {
    id: "c1",
    clienteId: "cli-1",
    oportunidadId: "opp-1",
    canal: "whatsapp",
    externalThreadId: "wa:+525511112222",
    estadoBot: "escalado",
    asesorLockId: null,
    pasoGuion: "accion",
    camposCapturados: { aforo: 80, nombre: "Ana" },
    paqueteTentativoId: null,
    ultimaRuta: "guion",
    motivoHandoff: "solicitud_usuario",
    escaladoEn: new Date(),
    creadoEn: new Date(),
    guionVersion: "v4",
    slaVenceEn: null,
    cola: "comercial",
    cliente: {
      id: "cli-1",
      asesorAsignadoId: null,
      optOutMensajeria: false,
      nombre: "Ana",
    },
    oportunidad: {
      briefJson: {},
      calificacion: "calificado",
      listoParaCotizar: false,
    },
    mensajes: [{ creadoEn: new Date() }],
    ...overrides,
  };
}

function build(row: Record<string, unknown> | null = hilo()) {
  const prisma = {
    conversacion: {
      findFirst: jest.fn(async () => row),
    },
    mensaje: {
      create: jest.fn(async (args: { data: { contenido: string } }) => ({
        id: "msg-asesor",
        contenido: args.data.contenido,
        creadoEn: new Date("2026-10-15T18:00:00.000Z"),
      })),
    },
    interaccion: { create: jest.fn(async () => ({ id: "int-1" })) },
    cliente: { update: jest.fn(async () => ({ id: "cli-1" })) },
  };
  const outbound = {
    send: jest.fn(async () => ({ ok: true, providerMessageId: "SM1" })),
  };
  const conversations = {
    getById: jest.fn(() => ({ id: "c1", estadoBot: "escalado" })),
    setEstadoBot: jest.fn(),
  };
  const orch = {
    id: "c1",
    camposCapturados: { aforo: 80, nombre: "Ana" },
    mensajes: [],
  } as unknown as ConversacionState;
  const orchStore = {
    findById: jest.fn(async () => orch),
    update: jest.fn(async () => orch),
    appendMensaje: jest.fn(async () => ({ id: "msg-asesor" })),
  };
  const expediente = {
    persistTomaControl: jest.fn(async () => undefined),
    persistAfterTurn: jest.fn(async () => undefined),
  };
  const audit = { record: jest.fn(async () => ({ id: "ev-1" })) };
  const memoria = { aplicarCamposAsesor: jest.fn(async () => undefined) };
  const svc = new BandejaService(
    prisma as never,
    outbound as never,
    conversations as never,
    orchStore as never,
    expediente as never,
    audit as never,
    memoria as never,
  );
  return { svc, prisma, outbound, expediente, orchStore, memoria, orch };
}

describe("BandejaService mensajes", () => {
  it("toma el control al responder y guarda el mensaje con el mismo id", async () => {
    const { svc, outbound, expediente, orchStore, prisma } = build();
    const res = await svc.enviarMensaje("c1", { contenido: "Hola, te atiendo yo" }, user);
    expect(res.estadoBot).toBe("humano");
    expect(res.entrega).toBe("enviado");
    expect(expediente.persistTomaControl).toHaveBeenCalled();
    expect(outbound.send).toHaveBeenCalledWith(
      expect.objectContaining({ texto: "Hola, te atiendo yo", canal: "whatsapp" }),
    );
    expect(orchStore.appendMensaje).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({
        id: "msg-asesor",
        autor: "asesor",
        externalMessageId: "SM1",
      }),
    );
    expect(prisma.mensaje.create).toHaveBeenCalledTimes(1);
  });

  it("no vuelve a tomar el control si el hilo ya es de este asesor", async () => {
    const { svc, expediente } = build(
      hilo({ estadoBot: "humano", asesorLockId: "asesor-1" }),
    );
    await svc.enviarMensaje("c1", { contenido: "sigo yo" }, user);
    expect(expediente.persistTomaControl).not.toHaveBeenCalled();
  });

  it("409 si otro asesor tiene el candado", async () => {
    const { svc, outbound } = build(hilo({ asesorLockId: "asesor-otro" }));
    await expect(
      svc.enviarMensaje("c1", { contenido: "hola" }, user),
    ).rejects.toMatchObject({ status: 409 });
    expect(outbound.send).not.toHaveBeenCalled();
  });

  it("409 si el cliente pidió no recibir mensajes", async () => {
    const row = hilo();
    (row.cliente as { optOutMensajeria: boolean }).optOutMensajeria = true;
    const { svc, expediente } = build(row);
    try {
      await svc.enviarMensaje("c1", { contenido: "hola" }, user);
      throw new Error("debio fallar");
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getResponse()).toMatchObject({
        error: { code: "OPT_OUT" },
      });
    }
    expect(expediente.persistTomaControl).not.toHaveBeenCalled();
  });

  it("409 si la ventana de WhatsApp ya cerró", async () => {
    const ayer = new Date(Date.now() - 25 * 60 * 60 * 1000);
    const { svc, outbound } = build(hilo({ mensajes: [{ creadoEn: ayer }] }));
    try {
      await svc.enviarMensaje("c1", { contenido: "hola" }, user);
      throw new Error("debio fallar");
    } catch (err) {
      expect((err as HttpException).getResponse()).toMatchObject({
        error: { code: "VENTANA_CERRADA" },
      });
    }
    expect(outbound.send).not.toHaveBeenCalled();
  });

  it("un hilo sandbox no se envía por Twilio", async () => {
    const { svc, outbound } = build(
      hilo({ canal: "whatsapp", externalThreadId: "sandbox-web-1", mensajes: [] }),
    );
    const res = await svc.enviarMensaje("c1", { contenido: "prueba" }, user);
    expect(res.entrega).toBe("sandbox");
    expect(outbound.send).not.toHaveBeenCalled();
  });

  it("502 y no guarda nada si Twilio rechaza el envío", async () => {
    const { svc, outbound, prisma } = build();
    (outbound.send as jest.Mock).mockResolvedValue({
      ok: false,
      reason: "TWILIO_21610",
    });
    await expect(
      svc.enviarMensaje("c1", { contenido: "hola" }, user),
    ).rejects.toMatchObject({ status: 502 });
    expect(prisma.mensaje.create).not.toHaveBeenCalled();
  });

  it("limita al asesor a sus clientes o a los que no tienen dueño", async () => {
    const { svc, prisma } = build();
    await svc.enviarMensaje("c1", { contenido: "hola" }, user);
    expect(prisma.conversacion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          cliente: {
            OR: [
              { asesorAsignadoId: "asesor-1" },
              { asesorAsignadoId: null },
            ],
          },
        }),
      }),
    );
  });
});

describe("BandejaService brief", () => {
  it("escribe el null en memoria, en el hilo y en el expediente", async () => {
    const { svc, memoria, orchStore, expediente, orch } = build(
      hilo({ estadoBot: "humano", asesorLockId: "asesor-1" }),
    );
    await svc.actualizarBrief("c1", { aforo: null }, user);
    expect(memoria.aplicarCamposAsesor).toHaveBeenCalledWith("cli-1", {
      aforo: null,
    });
    expect(orchStore.update).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({
        camposCapturados: expect.objectContaining({ aforo: null, nombre: "Ana" }),
      }),
    );
    expect(expediente.persistAfterTurn).toHaveBeenCalledWith(
      expect.objectContaining({
        id: orch.id,
        camposCapturados: expect.objectContaining({ aforo: null }),
      }),
      { actor: "asesor" },
    );
  });
});
