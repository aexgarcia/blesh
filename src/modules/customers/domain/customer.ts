/**
 * Reglas de la ficha de cliente. El teléfono se normaliza para buscar y comparar,
 * pero no es una identidad: varias fichas pueden compartirlo (familias, números reasignados).
 */

export type FieldProblem = { field: "name" | "phone" | "email" | "reason"; message: string };
type Parsed<T> = { ok: true; value: T } | { ok: false; problem: FieldProblem };

const PHONE_HINT = "Usa un celular de 9 dígitos (987 654 321) o el formato internacional (+código de país).";

/**
 * Normaliza a E.164. Perú por defecto: celular de 9 dígitos que empieza por 9.
 * Internacional con «+» o «00»: 8 a 15 dígitos; con +51 se exige el formato peruano.
 */
export function normalizePhone(raw: string): Parsed<string> {
  const fail = (message: string): Parsed<string> => ({ ok: false, problem: { field: "phone", message } });
  const input = raw.trim();
  if (!input) return fail("Indica el teléfono.");
  const plusSigns = input.split("+").length - 1;
  let international = /^\(?\+/.test(input);
  if (/[^\d\s()+.-]/.test(input) || plusSigns > 1 || (plusSigns === 1 && !international)) return fail(PHONE_HINT);

  let digits = input.replace(/\D/g, "");
  if (!international && digits.startsWith("00")) {
    digits = digits.slice(2);
    international = true;
  }
  if (!international && digits.length === 11 && digits.startsWith("519")) international = true;

  if (!international) {
    return /^9\d{8}$/.test(digits) ? { ok: true, value: `+51${digits}` } : fail(PHONE_HINT);
  }
  if (digits.startsWith("51")) {
    // Celular (9 dígitos) o fijo con código de área (8 dígitos: Lima 1 + 7, provincias 2 + 6).
    return /^51(9\d{8}|[1-8]\d{7})$/.test(digits) ? { ok: true, value: `+${digits}` } : fail(PHONE_HINT);
  }
  return /^[1-9]\d{7,14}$/.test(digits) ? { ok: true, value: `+${digits}` } : fail(PHONE_HINT);
}

/** Presentación legible: +51 987 654 321. Otros países se muestran sin agrupar. */
export function formatPhone(normalized: string): string {
  const pe = /^\+51(9\d{2})(\d{3})(\d{3})$/.exec(normalized);
  return pe ? `+51 ${pe[1]} ${pe[2]} ${pe[3]}` : normalized;
}

export function normalizeName(raw: string): Parsed<string> {
  const value = raw.normalize("NFC").replace(/\s+/g, " ").trim();
  if (value.length < 2) return { ok: false, problem: { field: "name", message: "Indica el nombre (mínimo 2 caracteres)." } };
  if (value.length > 120) return { ok: false, problem: { field: "name", message: "Máximo 120 caracteres." } };
  return { ok: true, value };
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Email opcional: vacío → null. Se guarda en minúsculas. */
export function normalizeEmail(raw: string | null | undefined): Parsed<string | null> {
  const value = (raw ?? "").trim().toLowerCase();
  if (!value) return { ok: true, value: null };
  if (value.length > 254 || !EMAIL_PATTERN.test(value)) return { ok: false, problem: { field: "email", message: "Correo no válido." } };
  return { ok: true, value };
}

export type CustomerFields = { name: string; phone: string; email: string | null };

/** Valida y normaliza los campos editables de una ficha. */
export function parseCustomerFields(input: { name: string; phone: string; email?: string | null }): Parsed<CustomerFields> {
  const name = normalizeName(input.name);
  if (!name.ok) return name;
  const phone = normalizePhone(input.phone);
  if (!phone.ok) return phone;
  const email = normalizeEmail(input.email);
  if (!email.ok) return email;
  return { ok: true, value: { name: name.value, phone: phone.value, email: email.value } };
}

/**
 * Interpreta un texto de búsqueda: si parece teléfono (≥ 4 dígitos y sin letras)
 * se busca por dígitos; si no, por nombre/correo.
 */
export function parseSearch(raw: string): { kind: "none" } | { kind: "phone"; digits: string } | { kind: "text"; text: string } {
  const text = raw.normalize("NFC").replace(/\s+/g, " ").trim().slice(0, 80);
  if (!text) return { kind: "none" };
  const digits = text.replace(/\D/g, "");
  if (!/[a-zA-ZÀ-ÿ@]/.test(text) && digits.length >= 4) {
    // Un celular peruano escrito sin prefijo coincide igualmente (se busca por subcadena).
    return { kind: "phone", digits };
  }
  return { kind: "text", text };
}

/** Motivo obligatorio para acciones del propietario (archivar). */
export function parseReason(raw: string | null | undefined, required: boolean): Parsed<string | null> {
  const value = (raw ?? "").trim();
  if (!value) return required ? { ok: false, problem: { field: "reason", message: "Indica el motivo." } } : { ok: true, value: null };
  if (value.length < 3 || value.length > 300) return { ok: false, problem: { field: "reason", message: "Entre 3 y 300 caracteres." } };
  return { ok: true, value };
}
