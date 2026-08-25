import "dotenv/config";
import { CatalogSnapshotSchema } from "@tres-cielos/shared";
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

async function main() {
  const fixtures = path.resolve(__dirname, "../../../../fixtures/catalog");
  const raw = JSON.parse(
    fs.readFileSync(path.join(fixtures, "golden-snapshot.json"), "utf8"),
  );
  const snapshot = CatalogSnapshotSchema.parse(raw);
  const prisma = new PrismaClient();

  try {
    const { CatalogSeedService } = await import("./catalog-seed.service");
    const seed = new CatalogSeedService(prisma as never);
    const result = await seed.seedFromSnapshot(snapshot, "golden-snapshot.json");
    // eslint-disable-next-line no-console
    console.log("sandbox:seed OK", result);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
