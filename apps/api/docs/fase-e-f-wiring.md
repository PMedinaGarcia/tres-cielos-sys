# Fase E + F — cableado y gaps

## Cómo cablear `OrchestratorService`

`ChannelsModule` inyecta el token `TURN_HANDLER` (`apps/api/src/channels/turn-handler.ts`).

Hoy usa `OrchestratorTurnAdapter` (`ChannelsModule` importa `ConversationOrchestratorModule`).

```ts
{
  provide: TURN_HANDLER,
  useFactory: (orch: OrchestratorService) =>
    new OrchestratorTurnAdapter(orch),
  inject: [OrchestratorService],
}
```

Consumo OCR en turno (E7): inyectar `OcrPriceGateService` en orquestador/RAG antes de redactar montos.

Ports: usar solo `ports/tokens.ts` — AiProvidersModule ya registra OBJECT_STORAGE / VISION / TRANSCRIPTION.

---

## Object storage (E1)

| Modo | Cómo |
|---|---|
| CI / default | FakeObjectStoragePort (`STORAGE_PROVIDER=memory`) |
| Dev FS | `FsObjectStorageAdapter` en knowledge-ingestion/storage |
| Staging | MinIO Compose `localhost:9000`, bucket `trescielos-media` |

```bash
docker compose up -d minio minio-init
```

Consola: http://localhost:9001 (trescielos / localdevminio).

---

## Checklist smoke E2E staging (F7)

1. META/TWILIO secrets en staging
2. GET Meta verify challenge OK
3. POST mensaje → HTTP 200 ACK rápido
4. Firma inválida → 401
5. Idempotencia MessageSid/mid
6. Guion → calificado + notif
7. Precio SKU → tool catálogo
8. FAQ → RAG + cita
9. Pedido humano → escalado + SLA 15–30 min
10. tomar-control → humano; inbound → silencio
11. Adjunto → storage; publicaAK=false
12. Foto tarifas + precio → material_ocr_tarifas (0 montos OCR)
13. Cupo hard → cupo_ia
14. Binarios solo en MinIO (storage_key en DB)

Bypass local: `x-dev-bypass-signature: 1` si APP_ENV≠prod.

---

## Gaps

| Gap | Dueño |
|---|---|
| Wire TURN_HANDLER → OrchestratorTurnAdapter | Hecho: ChannelsModule |
| Chat sandbox HTTP | `POST /channels/sandbox/inbound` (mismo `InboundPipelineService` que Twilio) |
| Prisma CRM/Conversacion/Asset/Fragmento | Fase A |
| AuthGuard en tomar-control | auth/ |
| FETCH_CHANNEL_MEDIA prod | ops |
| BullMQ ingesta real | worker |
| Unificar ConversationStateStore ↔ ConversationStoreService | B+F |
