import { assembleSourcePlugins, SourcePluginRegistry } from "./source-plugin.registry";
import { TariffScrubService } from "../scrub/tariff-scrub.service";
import { PdfParser } from "../parsers/pdf.parser";
import { DocxParser } from "../parsers/docx.parser";
import { XlsRouter } from "../parsers/xls.router";
import { PhotoPipeline } from "../parsers/photo.pipeline";
import { VideoPipeline } from "../parsers/video.pipeline";
import { FakeVisionPort } from "../../ports/__fakes__/fake-vision.port";
import { FakeTranscriptionPort } from "../../ports/__fakes__/fake-transcription.port";

describe("SourcePluginRegistry", () => {
  it("resuelve plugins por MIME y lista ids estables", () => {
    const scrub = new TariffScrubService();
    const registry = new SourcePluginRegistry(
      assembleSourcePlugins({
        pdf: new PdfParser(scrub),
        docx: new DocxParser(scrub),
        xls: new XlsRouter(scrub),
        photo: new PhotoPipeline(new FakeVisionPort(), scrub),
        video: new VideoPipeline(new FakeTranscriptionPort(), scrub),
      }),
    );

    expect(registry.list().map((p) => p.id).sort()).toEqual(
      ["docx", "pdf", "photo", "video", "xls"].sort(),
    );
    expect(registry.resolve("application/pdf")?.id).toBe("pdf");
    expect(registry.resolve("image/jpeg")?.id).toBe("photo");
    expect(registry.resolve("application/zip")).toBeUndefined();
  });
});
