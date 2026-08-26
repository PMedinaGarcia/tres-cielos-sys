import { paqueteBodas2027Document, publicApiBaseUrl } from "../guion-assets";

describe("guion-assets", () => {
  const prevUrl = process.env.PUBLIC_API_URL;
  const prevPort = process.env.PORT;

  afterEach(() => {
    if (prevUrl === undefined) delete process.env.PUBLIC_API_URL;
    else process.env.PUBLIC_API_URL = prevUrl;
    if (prevPort === undefined) delete process.env.PORT;
    else process.env.PORT = prevPort;
  });

  it("arma URL absoluta del PDF con PUBLIC_API_URL", () => {
    process.env.PUBLIC_API_URL = "https://api.trescielos.test/";
    expect(publicApiBaseUrl()).toBe("https://api.trescielos.test");
    const doc = paqueteBodas2027Document();
    expect(doc.mime).toBe("application/pdf");
    expect(doc.filename).toBe("Tres Cielos Paquete Bodas 2027.pdf");
    expect(doc.url).toBe(
      "https://api.trescielos.test/public/guion/paquete-bodas-2027.pdf",
    );
  });
});
