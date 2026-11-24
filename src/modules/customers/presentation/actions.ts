"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireAdminActor } from "@/modules/identity/server";
import { errorState, type FormState } from "@/shared/forms/form-state";

import * as management from "../application/customer-management";
import { CUSTOMER_STATUS_LABELS, CUSTOMERS_PAGE_SIZE, type CustomerPage, type CustomerStatus } from "../contracts";
import { CustomerFailure, getCustomerDeps, searchCustomers } from "../server";

const text = (max: number) => z.string().max(max).optional().default("");
const contactSchema = z.object({
  name: text(200),
  phone: text(40),
  email: text(254),
  confirmSharedPhone: z.literal("on").optional(),
});
const ref = z.object({ id: z.uuid(), expectedVersion: z.coerce.number().int().positive() });

function fields(formData: FormData) {
  return Object.fromEntries(formData) as Record<string, string>;
}

function toState(result: Exclude<management.CustomerResult<unknown>, { ok: true }>): FormState {
  return {
    ...errorState(result.message, result.field ? { [result.field]: result.message } : undefined),
    code: result.code,
    related: result.matches?.map((m) => ({ id: m.id, label: m.name, meta: CUSTOMER_STATUS_LABELS[m.status] })),
  };
}

export async function createCustomerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  const parsed = contactSchema.extend({ creationKey: z.uuid() }).safeParse(fields(formData));
  if (!parsed.success) return errorState("Solicitud inválida. Recarga la página.");
  const { confirmSharedPhone, ...input } = parsed.data;
  const result = await management.createCustomer(getCustomerDeps(), actor, { ...input, confirmSharedPhone: confirmSharedPhone === "on" });
  if (!result.ok) return toState(result);
  redirect(`/admin/clientes/${result.value.id}?creado=1`);
}

export async function updateCustomerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  const parsed = contactSchema.extend(ref.shape).safeParse(fields(formData));
  if (!parsed.success) return errorState("Solicitud inválida. Recarga la página.");
  const { confirmSharedPhone, ...input } = parsed.data;
  const result = await management.updateCustomer(getCustomerDeps(), actor, { ...input, confirmSharedPhone: confirmSharedPhone === "on" });
  if (!result.ok) return toState(result);
  refresh();
  return { status: "success", message: "Datos guardados." };
}

export async function archiveCustomerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  const parsed = ref.extend({ reason: text(300) }).safeParse(fields(formData));
  if (!parsed.success) return errorState("Solicitud inválida. Recarga la página.");
  const result = await management.archiveCustomer(getCustomerDeps(), actor, parsed.data);
  if (!result.ok) return toState(result);
  refresh();
  return { status: "success", message: "Ficha archivada. Sus pedidos se conservan." };
}

export async function reactivateCustomerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireAdminActor();
  const parsed = ref.extend({ reason: text(300) }).safeParse(fields(formData));
  if (!parsed.success) return errorState("Solicitud inválida. Recarga la página.");
  const result = await management.reactivateCustomer(getCustomerDeps(), actor, parsed.data);
  if (!result.ok) return toState(result);
  refresh();
  return { status: "success", message: "Ficha reactivada." };
}

const searchSchema = z.object({
  search: z.string().max(80).default(""),
  status: z.enum(["active", "archived", ""]).default("active"),
  page: z.number().int().min(1).max(10_000).default(1),
});

export type SearchCustomersResult = { ok: true; page: CustomerPage } | { ok: false; message: string };

/**
 * Búsqueda por POST (Server Action): el texto buscado —a menudo un teléfono— no viaja en la URL,
 * así no queda en el historial, en registros de acceso ni en analítica.
 */
export async function searchCustomersAction(input: { search: string; status: CustomerStatus | ""; page: number }): Promise<SearchCustomersResult> {
  const actor = await requireAdminActor();
  const parsed = searchSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Búsqueda inválida." };
  try {
    const page = await searchCustomers(actor, { search: parsed.data.search, status: parsed.data.status || undefined, page: parsed.data.page, pageSize: CUSTOMERS_PAGE_SIZE });
    return { ok: true, page };
  } catch (error) {
    if (error instanceof CustomerFailure) return { ok: false, message: error.message };
    throw error;
  }
}

