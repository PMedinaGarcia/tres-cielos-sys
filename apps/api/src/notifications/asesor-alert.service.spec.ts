import { NotificationsService } from "./notifications.service";
import { AsesorAlertService } from "./asesor-alert.service";
import { ResendMailerService } from "./resend-mailer.service";

jest.mock("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: jest.fn(async () => ({ data: { id: "email_1" }, error: null })) },
  })),
}));

type Usuario = { id: string; email: string; activo: boolean; rol: string; disponible?: boolean };

function ficha(over: {
  asesorLockId?: string | null;
  asesorAsignadoId?: string | null;
  oportunidadAsesorId?: string | null;
  sedeInteresId?: string | null;
  nombre?: string | null;
  telefono?: string | null;
} = {}) {
  return {
    sede: null,
    asesorLockId: over.asesorLockId ?? null,
    cliente: {
      id: "cli-1",
      nombre: over.nombre === undefined ? "Ana López" : over.nombre,
      telefono: over.telefono === undefined ? "+5215511111111" : over.telefono,
      nombrePerfilCanal: null,
      asesorAsignadoId: over.asesorAsignadoId ?? null,
      sedeInteresId: over.sedeInteresId === undefined ? "sede-1" : over.sedeInteresId,
    },
    oportunidad: { asesorAsignadoId: over.oportunidadAsesorId ?? null },
  };
}

function prismaDe(opts: { conv: ReturnType<typeof ficha> | null; usuarios: Usuario[] }) {
  return {
    conversacion: {
      findUnique: jest.fn(async () => opts.conv),
    },
    usuario: {
      findFirst: jest.fn(async (args: { where: { id: string; activo?: boolean } }) => {
        const u = opts.usuarios.find((row) => row.id === args.where.id);
        if (!u) return null;
        if (args.where.activo && !u.activo) return null;
        return { email: u.email };
      }),
      findMany: jest.fn(async (args: { where: { rol: string } }) => {
        return opts.usuarios
          .filter((u) => u.rol === args.where.rol && u.activo && (u.rol !== "asesor" || u.disponible))
          .map((u) => ({ email: u.email }));
      }),
    },
  };
}

function correoMock(ok = true) {
  return jest.fn(async () => ({ ok })) as jest.Mock;
}

function aviso(id: string, over: { sandbox?: boolean; texto?: string } = {}) {
  return {
    conversacionId: "conv-1",
    canal: "whatsapp",
    externalMessageId: id,
    texto: over.texto ?? "Hola, sigo aquí",
    sandbox: over.sandbox,
  };
}

describe("AsesorAlertService", () => {
  const prevPanel = process.env.PANEL_PUBLIC_URL;

  beforeEach(() => {
    process.env.PANEL_PUBLIC_URL = "https://trescielosbot.org";
  });

  afterEach(() => {
    if (prevPanel === undefined) delete process.env.PANEL_PUBLIC_URL;
    else process.env.PANEL_PUBLIC_URL = prevPanel;
    jest.useRealTimers();
  });

  it("envía cada mensaje al asesor dueño y no repite el mismo id", async () => {
    const send = correoMock();
    const svc = new AsesorAlertService(
      { send } as unknown as ResendMailerService,
      prismaDe({
        conv: ficha({ asesorLockId: "asesor-1" }),
        usuarios: [{ id: "asesor-1", email: "ana@tres.mx", activo: true, rol: "asesor", disponible: true }],
      }) as never,
    );

    await svc.avisar(aviso("m1"));
    await svc.avisar(aviso("m2"));
    await svc.avisar(aviso("m1"));

    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        to: ["ana@tres.mx"],
        subject: "Nuevo mensaje de Ana López",
        idempotencyKey: "mensaje:whatsapp:m1",
      }),
    );
    expect(send.mock.calls[0][0].html).toContain("https://trescielosbot.org/bandeja?c=cli-1");
    expect(send.mock.calls[0][0].html).toContain("+5215511111111");
    expect(send.mock.calls[1][0].idempotencyKey).toBe("mensaje:whatsapp:m2");
  });

  it("sin dueño avisa a los coordinadores de la sede y agrupa 2 minutos", async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-11-01T18:00:00Z"));
    const send = correoMock();
    const svc = new AsesorAlertService(
      { send } as unknown as ResendMailerService,
      prismaDe({
        conv: ficha(),
        usuarios: [
          { id: "c1", email: "coord@tres.mx", activo: true, rol: "coordinador" },
          { id: "c2", email: "coord2@tres.mx", activo: true, rol: "coordinador" },
        ],
      }) as never,
    );

    await svc.avisar(aviso("m1"));
    await svc.avisar(aviso("m2"));
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].to).toEqual(["coord@tres.mx"]);
    expect(send.mock.calls[0][0].bcc).toEqual(["coord2@tres.mx"]);

    jest.setSystemTime(new Date("2026-11-01T18:02:01Z"));
    await svc.avisar(aviso("m3"));
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("si la sede no tiene asesores, avisa a coordinadores", async () => {
    const send = correoMock();
    const db = prismaDe({
      conv: ficha(),
      usuarios: [{ id: "c", email: "coord@tres.mx", activo: true, rol: "coordinador" }],
    });
    const svc = new AsesorAlertService({ send } as unknown as ResendMailerService, db as never);
    await svc.avisar(aviso("m1"));
    expect(db.usuario.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ rol: "coordinador" }) }),
    );
    expect(send.mock.calls[0][0].to).toEqual(["coord@tres.mx"]);
  });

  it("no envía en sandbox", async () => {
    const send = correoMock();
    const svc = new AsesorAlertService(
      { send } as unknown as ResendMailerService,
      prismaDe({
        conv: ficha({ asesorLockId: "asesor-1" }),
        usuarios: [{ id: "asesor-1", email: "ana@tres.mx", activo: true, rol: "asesor" }],
      }) as never,
    );
    await svc.avisar(aviso("m1", { sandbox: true }));
    expect(send).not.toHaveBeenCalled();
  });

  it("si el correo falla, un reintento del mismo mensaje vuelve a intentar", async () => {
    const send = correoMock(false);
    const svc = new AsesorAlertService(
      { send } as unknown as ResendMailerService,
      prismaDe({
        conv: ficha({ asesorLockId: "asesor-1" }),
        usuarios: [{ id: "asesor-1", email: "ana@tres.mx", activo: true, rol: "asesor" }],
      }) as never,
    );
    await svc.avisar(aviso("m1"));
    await svc.avisar(aviso("m1"));
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("recorta el extracto largo", async () => {
    const send = correoMock();
    const svc = new AsesorAlertService(
      { send } as unknown as ResendMailerService,
      prismaDe({
        conv: ficha({ asesorLockId: "asesor-1" }),
        usuarios: [{ id: "asesor-1", email: "ana@tres.mx", activo: true, rol: "asesor" }],
      }) as never,
    );
    await svc.avisar(aviso("m1", { texto: "a".repeat(600) }));
    const html = send.mock.calls[0][0].html as string;
    expect(html).toContain(`${"a".repeat(497)}…`);
    expect(html).not.toContain("a".repeat(500));
  });
});

describe("ResendMailerService", () => {
  const prevKey = process.env.RESEND_API_KEY;

  afterEach(() => {
    if (prevKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = prevKey;
  });

  it("sin clave no llama a Resend", async () => {
    delete process.env.RESEND_API_KEY;
    const { Resend } = jest.requireMock("resend") as { Resend: jest.Mock };
    Resend.mockClear();
    const mailer = new ResendMailerService();
    const res = await mailer.send({
      to: ["ana@tres.mx"],
      subject: "Nuevo mensaje de Ana",
      html: "<p>hola</p>",
      text: "hola",
      idempotencyKey: "mensaje:whatsapp:m1",
    });
    expect(res).toEqual({ ok: false });
    expect(Resend).not.toHaveBeenCalled();
  });
});

describe("NotificationsService correo", () => {
  it("delega el aviso sin bloquear el registro de panel", async () => {
    const avisar = jest.fn(async () => undefined);
    const svc = new NotificationsService({ avisar } as unknown as AsesorAlertService);
    const n = await svc.notifyEscalacion({
      conversacionId: "c1",
      motivo: "queja",
      canal: "whatsapp",
      externalMessageId: "m1",
      texto: "hola",
    });
    expect(n.tipo).toBe("escalacion");
    expect(n.canalEntrega).toBe("panel");
    expect(avisar).toHaveBeenCalledWith(
      expect.objectContaining({ externalMessageId: "m1", motivo: "queja" }),
    );
  });
});
