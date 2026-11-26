import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_WELCOME_OFFER, generalSettingsSchema } from "@/modules/content/application/general-settings";
import { saveSection } from "@/modules/content/application/section-settings";

const data = { welcomeOffer: DEFAULT_WELCOME_OFFER, businessName: " BLESH ", legalName: "", taxId: "", location: "Lima, Perú", address: "", openingHours: "", orderWhatsapp: "+51 900 000 000", contactWhatsapp: "", email: "  AYUDA@EXAMPLE.COM  ", instagramUrl: "https://www.instagram.com/blesh_pe/", tiktokUrl: "", floatingWhatsapp: true };
describe("configuración general", () => {
  it("normaliza números/textos y permite ocultar contactos vacíos", () => {
    expect(generalSettingsSchema.parse(data)).toMatchObject({ businessName: "BLESH", orderWhatsapp: "51900000000", email: "ayuda@example.com", contactWhatsapp: "" });
    expect(generalSettingsSchema.safeParse({ ...data, orderWhatsapp: "", email: "", instagramUrl: "" }).success).toBe(true);
  });
  it("rechaza números, correos, RUC y URLs inválidos", () => {
    for (const change of [{ orderWhatsapp: "https://wa.me/51900000000" }, { contactWhatsapp: "123" }, { contactWhatsapp: "+51abc900000000" }, { contactWhatsapp: "0123456789" }, { email: "x@y\r\nBcc:evil" }, { taxId: "123" }, { businessName: " " }, { instagramUrl: "https://instagram.com.evil.test/user" }, { instagramUrl: "javascript:alert(1)" }, { instagramUrl: "https://user:pass@instagram.com/user" }, { instagramUrl: "https://instagram.com/user?track=1" }, { tiktokUrl: "https://instagram.com/user" }]) expect(generalSettingsSchema.safeParse({ ...data, ...change }).success).toBe(false);
  });
  it("descuento de bienvenida: guardados antiguos lo traen desactivado y activarlo exige código", () => {
    const { welcomeOffer: _w, ...legacy } = data;
    void _w;
    expect(generalSettingsSchema.parse(legacy).welcomeOffer.enabled).toBe(false);
    const offer = (change: object) => generalSettingsSchema.safeParse({ ...data, welcomeOffer: { ...DEFAULT_WELCOME_OFFER, enabled: true, ...change } });
    expect(offer({ code: " bienvenida10 " }).data?.welcomeOffer.code).toBe("BIENVENIDA10");
    expect(offer({ code: "" }).success).toBe(false);
    expect(offer({ code: "NO VALE" }).success).toBe(false);
    expect(offer({ imageKey: "../secreto.webp" }).success).toBe(false);
    expect(offer({ imageKey: "hero/banner.webp" }).success).toBe(true);
  });
  it("operator no puede guardar aunque la entrada sea válida", async () => {
    const save = vi.fn();
    await expect(saveSection({ store: { save }, authorize: () => false }, { membershipId: randomUUID(), role: "operator" }, "general", { data, expectedVersion: 0, operationKey: randomUUID() })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(save).not.toHaveBeenCalled();
  });
});
