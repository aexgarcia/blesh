import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email("Ingresa un correo válido.")).pipe(z.string().max(254));

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Ingresa tu contraseña.").max(200),
});

export const totpCodeSchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/, "El código tiene 6 dígitos."),
  factorId: z.uuid().optional().or(z.literal("").transform(() => undefined)),
});

/** Coincide con la política de Supabase local: mínimo 12, letras y dígitos. */
export const newPasswordSchema = z
  .object({
    password: z
      .string()
      .min(12, "Usa al menos 12 caracteres.")
      .max(200)
      .regex(/[A-Za-z]/, "Incluye al menos una letra.")
      .regex(/\d/, "Incluye al menos un número."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Las contraseñas no coinciden." });

export const roleSchema = z.enum(["owner", "operator"], { message: "Elige un rol." });

export const inviteSchema = z.object({
  email: emailSchema,
  displayName: z.string().trim().min(1, "Ingresa el nombre.").max(80, "Máximo 80 caracteres."),
  role: roleSchema,
});

export const membershipRefSchema = z.object({
  membershipId: z.uuid(),
  expectedVersion: z.coerce.number().int().positive().optional(),
});

export const reasonSchema = z.string().trim().max(300, "Máximo 300 caracteres.");
