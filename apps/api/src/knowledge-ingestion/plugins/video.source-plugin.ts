import { Injectable } from "@nestjs/common";
import { MIME_ALLOWLIST } from "../contracts/media.types";
import { VideoPipeline } from "../parsers/video.pipeline";
import type { SourcePlugin, SourcePluginContext, SourcePluginParseResult } from "./source-plugin";

@Injectable()
export class VideoSourcePlugin implements SourcePlugin {
  readonly id = "video";

  constructor(private readonly video: VideoPipeline) {}

  accepts(input: { mime: string }): boolean {
    return MIME_ALLOWLIST[input.mime] === "video";
  }

  async parse(ctx: SourcePluginContext): Promise<SourcePluginParseResult> {
    const v = await this.video.process({
      storageKey: ctx.storageKey,
      mime: ctx.mime,
      signedUrl: ctx.signedUrl,
      duracionMs: ctx.duracionMs,
    });
    if (v.rejected) {
      return { kind: "rejected", motivo: v.rejected };
    }
    return { kind: "fragments", fragments: v.fragments };
  }
}
