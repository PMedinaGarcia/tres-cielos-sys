import { FakeObjectStoragePort } from "../../ports/__fakes__/fake-object-storage.port";
import { FakeVisionPort } from "../../ports/__fakes__/fake-vision.port";
import { FakeTranscriptionPort } from "../../ports/__fakes__/fake-transcription.port";
import { TariffScrubService } from "../scrub/tariff-scrub.service";
import { PdfParser } from "../parsers/pdf.parser";
import { DocxParser } from "../parsers/docx.parser";
import { XlsRouter } from "../parsers/xls.router";
import { PhotoPipeline } from "../parsers/photo.pipeline";
import { VideoPipeline } from "../parsers/video.pipeline";
import { SlaTrackerService } from "../jobs/sla-tracker.service";
import { MediaRouterService } from "../media-router.service";
import {
  assembleSourcePlugins,
  SourcePluginRegistry,
} from "../plugins/source-plugin.registry";

export function buildTestMediaRouter(): MediaRouterService {
  const scrub = new TariffScrubService();
  const pdf = new PdfParser(scrub);
  const docx = new DocxParser(scrub);
  const xls = new XlsRouter(scrub);
  const photo = new PhotoPipeline(new FakeVisionPort(), scrub);
  const video = new VideoPipeline(new FakeTranscriptionPort(), scrub);
  const registry = new SourcePluginRegistry(
    assembleSourcePlugins({ pdf, docx, xls, photo, video }),
  );
  return new MediaRouterService(
    new FakeObjectStoragePort(),
    registry,
    new SlaTrackerService(),
  );
}
