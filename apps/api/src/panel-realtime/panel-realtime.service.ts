import { Injectable } from "@nestjs/common";
import { Observable, Subject, filter, map } from "rxjs";

export type PanelRealtimeEvent =
  | {
      type: "historial";
      clienteId: string;
      conversacionId: string;
      mensajeId?: string;
    }
  | {
      type: "bandeja";
      clienteId?: string;
    };

type StreamPayload = { data: PanelRealtimeEvent };

/**
 * Bus de eventos del panel (SSE). Sin dependencias de CRM/canales para evitar ciclos.
 */
@Injectable()
export class PanelRealtimeService {
  private readonly bus = new Subject<PanelRealtimeEvent>();

  emit(event: PanelRealtimeEvent): void {
    this.bus.next(event);
  }

  stream(): Observable<StreamPayload> {
    return this.bus.asObservable().pipe(map((event) => ({ data: event })));
  }

  streamForCliente(clienteId: string): Observable<StreamPayload> {
    return this.bus.pipe(
      filter(
        (event) =>
          event.type === "bandeja" ||
          (event.type === "historial" && event.clienteId === clienteId),
      ),
      map((event) => ({ data: event })),
    );
  }
}
