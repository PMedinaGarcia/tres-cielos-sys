import { Injectable } from "@nestjs/common";
import inventory from "./inventory.json";

export interface CorpusEntry {
  id: string;
  archivo?: string;
  alcance: string;
  temas: string[];
}

/**
 * Registro de líneas documentales. Ampliar = nueva entrada en inventory.json.
 */
@Injectable()
export class CorpusInventoryService {
  list(): CorpusEntry[] {
    return inventory.documentos as CorpusEntry[];
  }

  ids(): string[] {
    return [...inventory.inventario];
  }

  has(id: string): boolean {
    return this.ids().includes(id);
  }
}
