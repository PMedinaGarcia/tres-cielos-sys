import { guionFlujoDocuments, publicApiBaseUrl } from "../guion-assets";

describe("guion-assets", () => {
  const prevUrl = process.env.PUBLIC_API_URL;
  const prevPort = process.env.PORT;

  afterEach(() => {
    if (prevUrl === undefined) delete process.env.PUBLIC_API_URL;
    else process.env.PUBLIC_API_URL = prevUrl;
    if (prevPort === undefined) delete process.env.PORT;
    else process.env.PORT = prevPort;
  });

  it("arma las URL de los dos PDF del flujo", () => {
    process.env.PUBLIC_API_URL = "https://api.trescielos.test/";
    expect(publicApiBaseUrl()).toBe("https://api.trescielos.test");
    const docs = guionFlujoDocuments();
    expect(docs.map((doc) => doc.filename)).toEqual([
      "Experiencia boda de tres días - 2027.pdf",
      "Tarifas 2027 - Tres Cielos.pdf",
    ]);
    expect(docs.map((doc) => doc.url)).toEqual([
      "https://api.trescielos.test/public/guion/experiencia-boda-tres-dias-2027.pdf",
      "https://api.trescielos.test/public/guion/tarifas-2027-tres-cielos.pdf",
    ]);
    expect(docs.map((doc) => doc.delivery)).toEqual(["link", "media"]);
    expect(docs.every((doc) => doc.mime === "application/pdf")).toBe(true);
  });
});
