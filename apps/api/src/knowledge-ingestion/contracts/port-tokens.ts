/**
 * Re-export tokens canónicos de Fase A (`ports/tokens`).
 * Knowledge-ingestion NO redefine Symbols (evitar instancias distintas).
 */
export {
  OBJECT_STORAGE_PORT,
  VISION_PORT,
  TRANSCRIPTION_PORT,
} from "../../ports/tokens";
