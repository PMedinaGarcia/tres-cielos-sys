import { Injectable } from "@nestjs/common";
import { MIME_ALLOWLIST } from "../contracts/media.types";
import { PhotoPipeline } from "../parsers/photo.pipeline";
import type { SourcePlugin, SourcePluginContext, SourcePluginParseResult } from "./source-plugin";

@Injectable()
export class PhotoSourcePlugin implements SourcePlugin {
  readonly id = "photo";

  constructor(private readonly photo: PhotoPipeline) {}

  accepts(input: { mime: string }): boolean {
    return MIME_ALLOWLIST[input.mime] === "imagen";
  }

  async parse(ctx: SourcePluginContext): Promise<SourcePluginParseResult> {
    const fragments = await this.photo.process({
      storageKey: ctx.storageKey,
      mime: ctx.mime,
      signedUrl: ctx.signedUrl,
    });
    return { kind: "fragments", fragments };
  }
}
