import { ChannelAttachmentJobService } from "../jobs/channel-attachment-job.service";
import { PublishArchiveService } from "../jobs/publish-archive.service";
import { KnowledgeRepositoryStub } from "../repository/knowledge.repository.stub";
import { InMemoryFragmentRepository } from "../../rag/in-memory-fragment.repository";
import { SlaTrackerService } from "../jobs/sla-tracker.service";
import { PhotoPipeline } from "../parsers/photo.pipeline";
import { TariffScrubService } from "../scrub/tariff-scrub.service";
import { FakeVisionPort } from "../../ports/__fakes__/fake-vision.port";
import { buildTestMediaRouter } from "./build-test-media-router";

function buildRouter() {
  return buildTestMediaRouter();
}

describe("T-MED-LEAD adjunto canal no publica K", () => {
  it("origen adjunto_canal → publicaAK=false", async () => {
    const jobs = new ChannelAttachmentJobService(buildRouter());
    const job = await jobs.enqueueAndProcess({
      buffer: Buffer.from("Vista del jardín sin precios", "utf8"),
      mime: "image/jpeg",
      nombreArchivo: "foto.jpg",
      mensajeId: "SM1",
      conversacionId: "conv1",
    });
    expect(job.result?.publicaAK).toBe(false);
    expect(jobs.assertNoKPublication()).toBe(true);
  });
});

describe("Publish/archive + SLA", () => {
  it("publica PDF texto y archiva invalida fragmentos", async () => {
    const repo = new KnowledgeRepositoryStub();
    const sla = new SlaTrackerService();
    const rag = new InMemoryFragmentRepository();
    const publish = new PublishArchiveService(buildRouter(), repo, sla, rag);
    const { documento, fragments } = await publish.publish({
      titulo: "K02 Horarios",
      mime: "application/pdf",
      buffer: Buffer.from(
        "Horario de visitas martes a domingo. Sin montos.",
        "utf8",
      ),
      nombreArchivo: "horarios.pdf",
    });
    expect(documento.estadoPublicacion).toBe("publicado");
    expect(fragments.length).toBeGreaterThanOrEqual(1);
    expect(sla.latest()?.withinSla).toBe(true);

    const indexed = await rag.listRecuperables({ sedeId: null });
    expect(indexed.some((f) => f.inventarioId === "K02")).toBe(true);

    await publish.archive(documento.id);
    expect((await repo.listActiveFragments()).length).toBe(0);
    const after = await rag.listRecuperables({ sedeId: null });
    expect(after.every((f) => f.id !== fragments[0]?.id)).toBe(true);
  });
});

describe("Photo Vision fake @ci", () => {
  it("tarifa en key → noRecuperablePrecio", async () => {
    const photo = new PhotoPipeline(new FakeVisionPort(), new TariffScrubService());
    const frags = await photo.process({
      storageKey: "conocimiento/tarifa-jardin.jpg",
      mime: "image/jpeg",
    });
    expect(frags[0]?.noRecuperablePrecio).toBe(true);
  });
});
