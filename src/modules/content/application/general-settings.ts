import { z } from "zod";

import { isSocialProfile, normalizeWhatsapp } from "../domain/contact-details";

const phone = z.string().max(40).transform(normalizeWhatsapp).refine((value) => value === "" || /^[1-9]\d{7,14}$/.test(value), "Ingresa el número con código de país, por ejemplo +51 seguido de tu número.");
export const DEFAULT_WELCOME_OFFER = {
  enabled: false,
  eyebrow: "Beneficio de bienvenida",
  title: "10% off en tu primera compra",
  text: "Toca el botón y obtén tu código al instante. Lo enviamos junto con tu solicitud por WhatsApp.",
  buttonLabel: "Quiero mi código",
  code: "BIENVENIDA10",
  terms: "Válido en tu primera compra. No acumulable con otras promociones.",
  imageKey: "",
};

export const welcomeOfferSchema = z.object({
  enabled: z.boolean(),
  eyebrow: z.string().trim().max(60),
  title: z.string().trim().max(80),
  text: z.string().trim().max(240),
  buttonLabel: z.string().trim().max(40),
  code: z.string().trim().toUpperCase().refine((v) => v === "" || /^[A-Z0-9-]{3,30}$/.test(v), "El código usa de 3 a 30 letras, números o guiones."),
  terms: z.string().trim().max(200),
  imageKey: z.string().trim().refine((v) => v === "" || /^(hero|collections|banner|reels)\/[\w.-]+\.webp$/.test(v), "Elige una imagen de la biblioteca."),
}).superRefine((v, ctx) => {
  if (!v.enabled) return;
  if (!v.code) ctx.addIssue({ code: "custom", path: ["code"], message: "Indica el código del descuento para activarlo." });
  if (!v.title) ctx.addIssue({ code: "custom", path: ["title"], message: "Indica el título del descuento." });
  if (!v.buttonLabel) ctx.addIssue({ code: "custom", path: ["buttonLabel"], message: "Indica el texto del botón." });
});

export const generalSettingsSchema = z.object({
  // Guardados anteriores no lo tienen: se usa el valor por defecto (desactivado).
  welcomeOffer: welcomeOfferSchema.default(DEFAULT_WELCOME_OFFER),
  businessName: z.string().trim().min(1, "Ingresa el nombre comercial.").max(100),
  legalName: z.string().trim().max(150), taxId: z.string().trim().refine((v) => !v || /^\d{11}$/.test(v), "El RUC debe tener 11 dígitos."),
  location: z.string().trim().max(150), address: z.string().trim().max(250), openingHours: z.string().trim().max(250),
  orderWhatsapp: phone, contactWhatsapp: phone,
  email: z.string().trim().max(254).pipe(z.union([z.literal(""), z.email("Ingresa un correo válido.")])).transform((v) => v.toLowerCase()),
  instagramUrl: z.string().trim().max(300).refine((v) => isSocialProfile(v, "instagram"), "Usa la URL HTTPS de tu perfil de Instagram, sin parámetros."),
  tiktokUrl: z.string().trim().max(300).refine((v) => isSocialProfile(v, "tiktok"), "Usa la URL HTTPS de tu perfil de TikTok, sin parámetros."),
  floatingWhatsapp: z.boolean(),
});
