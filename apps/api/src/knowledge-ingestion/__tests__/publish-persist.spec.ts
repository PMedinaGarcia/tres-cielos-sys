import { PublishArchiveService } from "../jobs/publish-archive.service";
import { KnowledgeRepositoryStub } from "../repository/knowledge.repository.stub";
import { InMemoryFragmentRepository } from "../../rag/in-memory-fragment.repository";
import { SlaTrackerService } from "../jobs/sla-tracker.service";
import { FakeObjectStoragePort } from "../../ports/__fakes__/fake-object-storage.port";
import { STORAGE_PREFIXES } from "../../ports/storage-prefixes";
import { buildTestMediaRouter } from "./build-test-media-router";

describe("PublishArchive persistencia de metadatos", () => {
  it("guarda storageKey bajo conocimiento/ y escribe fragmentos en el repo", async () => {
    const repo = new KnowledgeRepositoryStub();
    const sla = new SlaTrackerService();
    const rag = new InMemoryFragmentRepository();
    const storage = new FakeObjectStoragePort();
    const publish = new PublishArchiveService(
      buildTestMediaRouter(storage),
      repo,
      sla,
      rag,
    );
    const { documento, fragments } = await publish.publish({
      titulo: "K01 FAQ",
      mime: "application/pdf",
      buffer: Buffer.from("Horarios comerciales martes a sábado.", "utf8"),
      nombreArchivo: "faq.pdf",
    });
    expect(documento.storageKey).toContain(`${STORAGE_PREFIXES.conocimiento}/`);
    expect(documento.inventarioId).toBe("K01");
    expect(fragments.length).toBeGreaterThanOrEqual(1);
    expect(await storage.exists(documento.storageKey)).toBe(true);
    const indexed = await rag.listRecuperables({ sedeId: null });
    expect(indexed.some((f) => f.inventarioId === "K01")).toBe(true);
  });
});
