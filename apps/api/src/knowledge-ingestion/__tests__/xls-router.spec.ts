import { XlsRouter } from "../parsers/xls.router";
import { TariffScrubService } from "../scrub/tariff-scrub.service";

describe("XlsRouter split catálogo vs narrativa", () => {
  const router = new XlsRouter(new TariffScrubService());

  it("CSV con sku/precio → catalogo", async () => {
    const csv = Buffer.from(
      "sku,nombre,precio\nBODA-J1,Esencial,45000\n",
      "utf8",
    );
    const r = await router.route(csv);
    expect(r.kind).toBe("catalogo");
    expect(r.catalogoRows?.length ?? 0).toBeGreaterThanOrEqual(1);
    expect(r.fragments.length).toBe(0);
  });

  it("CSV FAQ → narrativa", async () => {
    const csv = Buffer.from(
      "tema,texto\nhorarios,Visitas martes a domingo\n",
      "utf8",
    );
    const r = await router.route(csv);
    expect(r.kind).toBe("narrativa");
    expect(r.fragments.length).toBeGreaterThanOrEqual(1);
  });
});
