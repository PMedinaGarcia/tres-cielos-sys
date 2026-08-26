import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(
    helmet({
      // El panel Next (otro origen/puerto) consume esta API con fetch + cookies.
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
  app.use(cookieParser());
  const corsOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:3010")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({ origin: corsOrigins, credentials: true });

  const prefix = process.env.API_PREFIX?.trim();
  if (prefix) {
    app.setGlobalPrefix(prefix);
  }

  const port = Number(process.env.PORT ?? 3011);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${port}`);
}

bootstrap();
