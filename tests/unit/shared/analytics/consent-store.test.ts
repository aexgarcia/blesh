import { afterEach, expect, it, vi } from "vitest";

import { getConsent, saveConsent } from "@/shared/analytics/consent-store";
import { hasAnalyticsConsent } from "@/shared/analytics/track";

afterEach(() => { vi.unstubAllGlobals(); });

it("revocación prevalece aunque el navegador ya no permita escribir y conserve granted antiguo", () => {
  vi.stubGlobal("window", { localStorage: { getItem: () => "granted", setItem: () => { throw new Error("Storage blocked"); } }, dispatchEvent: () => true });
  expect(saveConsent("denied")).toBe(false);
  expect(getConsent()).toBe("denied");
  expect(hasAnalyticsConsent()).toBe(false);
});
