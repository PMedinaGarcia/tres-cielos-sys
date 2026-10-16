import type { WaContent } from "@tres-cielos/shared";
import { buildTwilioForms } from "../outbound.service";
import {
  clearRelayedImages,
  inlineGuionCardUrl,
  isBlockedAddress,
  prepareOutboundImages,
  readRelayedImage,
  toFilenameFreeImageUrl,
} from "../wa-image-alt";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

describe("texto alternativo de imágenes", () => {
  const prevUrl = process.env.PUBLIC_API_URL;

  afterEach(() => {
    clearRelayedImages();
    if (prevUrl === undefined) delete process.env.PUBLIC_API_URL;
    else process.env.PUBLIC_API_URL = prevUrl;
    jest.restoreAllMocks();
  });

  it("reescribe la card a una ruta sin nombre de archivo", () => {
    expect(
      inlineGuionCardUrl(
        "https://api.trescielos.test/public/guion/cards/02-paquetes-precios.jpg?x=1",
      ),
    ).toBe("https://api.trescielos.test/public/guion/i/02-paquetes-precios");
  });

  it("bloquea direcciones internas", () => {
    expect(isBlockedAddress("127.0.0.1")).toBe(true);
    expect(isBlockedAddress("10.1.2.3")).toBe(true);
    expect(isBlockedAddress("192.168.0.8")).toBe(true);
    expect(isBlockedAddress("169.254.169.254")).toBe(true);
    expect(isBlockedAddress("::ffff:127.0.0.1")).toBe(true);
    expect(isBlockedAddress("8.8.8.8")).toBe(false);
  });

  it("no reenvía una imagen cuya URL sigue siendo el nombre del archivo", async () => {
    await expect(
      toFilenameFreeImageUrl("https://127.0.0.1/atlante-encuesta.png"),
    ).resolves.toBeUndefined();
    await expect(
      toFilenameFreeImageUrl("http://metadata.google.internal/foto.jpg"),
    ).resolves.toBeUndefined();
  });

  it("publica la imagen ajena en una URL opaca y sin pie", async () => {
    process.env.PUBLIC_API_URL = "https://api.trescielos.test";
    jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: (name: string) => {
          if (name.toLowerCase() === "content-type") return "image/png";
          if (name.toLowerCase() === "content-length") return String(PNG.length);
          return null;
        },
      },
      arrayBuffer: async () =>
        Uint8Array.from(PNG).buffer,
    } as unknown as Response);

    const clean = await toFilenameFreeImageUrl(
      "https://8.8.8.8/atlante-encuesta-borrador-sentimiento-aficion-apertura-2026-1-vm-1080-noche-v2.png",
    );
    expect(clean).toMatch(
      /^https:\/\/api\.trescielos\.test\/public\/wa-img\/[a-f0-9]{32}$/,
    );
    const id = clean?.split("/").pop() ?? "";
    expect(readRelayedImage(id)?.contentType).toBe("image/png");
    expect(readRelayedImage(id)?.body.equals(PNG)).toBe(true);

    const wa: WaContent = {
      templateId: "canal.generic",
      kind: "text",
      body: "Prueba 1",
      images: [
        {
          url: "https://8.8.8.8/atlante-encuesta-borrador.png",
          caption: "atlante-encuesta-borrador.png",
        },
      ],
    };
    const prepared = await prepareOutboundImages(wa);
    const forms = buildTwilioForms({
      from: "whatsapp:+15044147172",
      to: "whatsapp:+5215512345678",
      texto: "Prueba 1",
      wa: prepared,
    });
    expect(forms[1]?.Body).toBeUndefined();
    expect(forms[1]?.MediaUrl).toMatch(/\/public\/wa-img\/[a-f0-9]{32}$/);
    expect(JSON.stringify(forms)).not.toContain("atlante-encuesta");
  });
});
