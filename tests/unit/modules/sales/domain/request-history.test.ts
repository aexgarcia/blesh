import { describe, expect, it } from "vitest";

import { markOpened, parseRequestHistory, rememberRequest, REQUEST_HISTORY_MAX, type StoredRequest } from "@/modules/sales/domain/request-history";

const now = new Date("2026-11-23T15:00:00Z");
const entry = (reference: string, hoursAgo = 0, over: Partial<StoredRequest> = {}): StoredRequest => ({
  reference,
  message: `Referencia: ${reference}`,
  whatsappUrl: "https://wa.me/51900000000?text=hola",
  whatsappChatUrl: "https://wa.me/51900000000",
  subtotalMinor: 4000,
  units: 1,
  savedAt: new Date(now.getTime() - hoursAgo * 3_600_000).toISOString(),
  opened: false,
  ...over,
});

describe("recuperación local de solicitudes", () => {
  it("guarda como máximo 3, la más reciente primero, sin duplicar por reintento", () => {
    let history: StoredRequest[] = [];
    for (const ref of ["BL-AAAAAA", "BL-BBBBBB", "BL-CCCCCC", "BL-DDDDDD"]) history = rememberRequest(history, entry(ref));
    expect(history.map((r) => r.reference)).toEqual(["BL-DDDDDD", "BL-CCCCCC", "BL-BBBBBB"]);
    history = markOpened(history, "BL-CCCCCC");
    history = rememberRequest(history, entry("BL-CCCCCC"));
    expect(history).toHaveLength(REQUEST_HISTORY_MAX);
    expect(history[0]).toMatchObject({ reference: "BL-CCCCCC", opened: true });
  });

  it("descarta entradas vencidas (7 días), inválidas o con enlaces ajenos a wa.me", () => {
    const raw = JSON.stringify([
      entry("BL-AAAAAA", 1),
      entry("BL-BBBBBB", 24 * 8),
      { ...entry("BL-CCCCCC"), whatsappUrl: "https://evil.example/?text=x" },
      { ...entry("BL-DDDDDD"), reference: "<script>" },
      "basura",
    ]);
    expect(parseRequestHistory(raw, now).map((r) => r.reference)).toEqual(["BL-AAAAAA"]);
    expect(parseRequestHistory("{", now)).toEqual([]);
    expect(parseRequestHistory(null, now)).toEqual([]);
  });

  it("acepta mensajes que no caben en el enlace (whatsappUrl null)", () => {
    expect(parseRequestHistory(JSON.stringify([entry("BL-AAAAAA", 0, { whatsappUrl: null })]), now)).toHaveLength(1);
  });
});
