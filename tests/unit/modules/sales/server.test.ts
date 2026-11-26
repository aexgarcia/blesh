import { afterEach, describe, expect, it, vi } from "vitest";

import { REQUEST_TERMS } from "@/modules/sales/contracts";
import { getOrderingStatus } from "@/modules/sales/server";

afterEach(() => vi.unstubAllEnvs());
describe("habilitación de pedidos con WhatsApp configurable", () => {
  it("el número guardado sustituye al inicial y un número vacío deshabilita", () => {
    vi.stubEnv("APP_ENV", "development"); vi.stubEnv("WHATSAPP_NUMBER", "51900000000");
    expect(getOrderingStatus("51911111111")).toMatchObject({ enabled: true, testMode: true });
    expect(getOrderingStatus(null)).toMatchObject({ enabled: false });
  });
  it("configurar WhatsApp conserva la comprobación de condiciones finales en producción", () => {
    vi.stubEnv("APP_ENV", "production"); vi.stubEnv("WHATSAPP_NUMBER", "");
    expect(getOrderingStatus("51900000000")).toMatchObject({ enabled: REQUEST_TERMS.status === "final", testMode: false });
  });
});
