"use client";

import { ClipboardCheck, SlidersHorizontal } from "lucide-react";
import { useState } from "react";

import { formatLimaDateTime } from "@/shared/domain/dates";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/shared/ui/dialog";
import { Field, Input, Select, Textarea } from "@/shared/ui/form";
import { FormMessage } from "@/shared/ui/form-message";
import { Alert, Badge, Card, CardHeader, EmptyState } from "@/shared/ui/surface";
import { SubmitButton } from "@/shared/ui/submit-button";
import { TBody, THead, Table, Td, Th, Tr } from "@/shared/ui/table";
import { useActionForm } from "@/shared/ui/use-action-form";

import { ADJUSTMENT_REASONS, REASON_LABELS, type StockBalance, type StockMovementView } from "../../contracts";
import { adjustStockAction, registerInitialStockAction } from "../actions";

/** Variante tal como la etiqueta quien compone la pantalla (inventory no conoce el catálogo). */
export type StockRowLabel = { variantId: string; label: string; sku: string; active: boolean };

export function StockPanel({ rows, balances, movements }: { rows: StockRowLabel[]; balances: Record<string, StockBalance>; movements: StockMovementView[] }) {
  const labels = new Map(rows.map((r) => [r.variantId, r]));
  if (rows.length === 0) {
    return (
      <Card>
        <EmptyState title="Sin tallas" description="Agrega colores y tallas para registrar su stock." />
      </Card>
    );
  }
  const pending = rows.filter((r) => !balances[r.variantId]).length;
  return (
    <div className="flex flex-col gap-5">
      {pending > 0 ? (
        <Alert tone="warning" title={`${pending} talla(s) sin stock inicial`}>
          Registra el conteo físico (puede ser 0) antes de publicar.
        </Alert>
      ) : null}
      <Card>
        <CardHeader title="Existencias" description="Físico = unidades en almacén · Reservado = comprometido por pedidos confirmados · Disponible = físico − reservado." />
        <Table>
          <THead>
            <Tr>
              <Th>Variante</Th>
              <Th className="text-right">Físico</Th>
              <Th className="text-right">Reservado</Th>
              <Th className="text-right">Disponible</Th>
              <Th className="text-right">
                <span className="sr-only">Acciones</span>
              </Th>
            </Tr>
          </THead>
          <TBody>
            {rows.map((row) => {
              const b = balances[row.variantId];
              return (
                <Tr key={row.variantId}>
                  <Td>
                    <p className="font-bold">
                      {row.label} {!row.active ? <Badge className="ml-1">Inactiva</Badge> : null}
                    </p>
                    <p className="font-mono text-[11px] text-muted">{row.sku}</p>
                  </Td>
                  {b ? (
                    <>
                      <Td className="text-right tabular-nums">{b.onHand}</Td>
                      <Td className="text-right tabular-nums text-muted">{b.reserved}</Td>
                      <Td className="text-right">
                        {b.available > 0 ? <span className="font-extrabold tabular-nums">{b.available}</span> : <Badge tone="danger">Agotado</Badge>}
                      </Td>
                    </>
                  ) : (
                    <Td colSpan={3} className="text-right">
                      <Badge tone="warning">Sin registrar</Badge>
                    </Td>
                  )}
                  <Td className="text-right">{b ? <AdjustDialog row={row} balance={b} /> : <InitialStockDialog row={row} />}</Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      </Card>

      <Card>
        <CardHeader title="Movimientos recientes" description="Historial inmutable de cambios de stock." />
        {movements.length === 0 ? (
          <p className="px-6 py-5 text-[13px] text-muted">Aún no hay movimientos.</p>
        ) : (
          <Table>
            <THead>
              <Tr>
                <Th>Fecha</Th>
                <Th>Variante</Th>
                <Th>Motivo</Th>
                <Th className="text-right">Cambio</Th>
                <Th className="text-right">Físico</Th>
              </Tr>
            </THead>
            <TBody>
              {movements.map((m) => (
                <Tr key={m.id}>
                  <Td className="whitespace-nowrap text-muted">{formatLimaDateTime(new Date(m.createdAt))}</Td>
                  <Td>{labels.get(m.variantId)?.label ?? "—"}</Td>
                  <Td>
                    {REASON_LABELS[m.reason] ?? m.reason}
                    {m.note ? <p className="text-[12px] text-muted">{m.note}</p> : null}
                  </Td>
                  <Td className={`text-right font-extrabold tabular-nums ${m.deltaOnHand > 0 ? "text-success" : "text-sale"}`}>
                    {m.deltaOnHand > 0 ? `+${m.deltaOnHand}` : m.deltaOnHand}
                  </Td>
                  <Td className="text-right tabular-nums">{m.onHandAfter}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}

function InitialStockDialog({ row }: { row: StockRowLabel }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <ClipboardCheck aria-hidden /> Registrar
        </Button>
      </DialogTrigger>
      <DialogContent title={`Stock inicial · ${row.label}`} description="Conteo físico actual de esta talla. Puede ser 0 (se mostrará agotada).">
        <InitialStockForm row={row} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

/**
 * Se monta en cada apertura. La clave de operación se mantiene mientras el diálogo
 * está abierto: reintentar tras un error o timeout no duplica el registro.
 */
function InitialStockForm({ row, onDone }: { row: StockRowLabel; onDone: () => void }) {
  const [operationKey] = useState(() => crypto.randomUUID());
  const { state, onSubmit, pending } = useActionForm(registerInitialStockAction, { onSuccess: onDone });
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="variantId" value={row.variantId} />
      <input type="hidden" name="operationKey" value={operationKey} />
      {state.status === "error" && !state.fieldErrors?.quantity ? <FormMessage state={state} /> : null}
      <Field label="Unidades contadas" error={state.fieldErrors?.quantity}>
        {(c) => <Input name="quantity" type="number" inputMode="numeric" min={0} step={1} defaultValue={0} required autoFocus {...c} />}
      </Field>
      <Field label="Nota (opcional)">{(c) => <Input name="note" maxLength={300} placeholder="Conteo del 23/11" {...c} />}</Field>
      <div className="flex justify-end gap-2 pt-1">
        <DialogClose asChild>
          <Button variant="ghost">Cancelar</Button>
        </DialogClose>
        <SubmitButton pending={pending} pendingLabel="Guardando…">
          Registrar stock
        </SubmitButton>
      </div>
    </form>
  );
}

function AdjustDialog({ row, balance }: { row: StockRowLabel; balance: StockBalance }) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <SlidersHorizontal aria-hidden /> Ajustar
        </Button>
      </DialogTrigger>
      <DialogContent title={`Ajustar · ${row.label}`} description={`Físico ${balance.onHand} · Reservado ${balance.reserved} · Disponible ${balance.available}`}>
        <AdjustForm row={row} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function AdjustForm({ row, onDone }: { row: StockRowLabel; onDone: () => void }) {
  const [operationKey] = useState(() => crypto.randomUUID());
  const [direction, setDirection] = useState<"in" | "out">("in");
  const { state, onSubmit, pending } = useActionForm(adjustStockAction, { onSuccess: onDone });
  const errors = state.fieldErrors ?? {};
  const reasons = ADJUSTMENT_REASONS.filter((r) => r !== "initial_count" && (direction === "in" ? r !== "damage" && r !== "loss" : r !== "restock"));
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="variantId" value={row.variantId} />
      <input type="hidden" name="operationKey" value={operationKey} />
      {state.status === "error" && !errors.quantity && !errors.note ? <FormMessage state={state} /> : null}
      <fieldset className="grid grid-cols-2 gap-2">
        <legend className="sr-only">Tipo de ajuste</legend>
        {(["in", "out"] as const).map((d) => (
          <label
            key={d}
            className="flex cursor-pointer items-center justify-center gap-2 rounded-full border border-line px-4 py-2.5 text-[11px] font-extrabold uppercase tracking-[0.05em] has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-white has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink"
          >
            <input type="radio" name="direction" value={d} checked={direction === d} onChange={() => setDirection(d)} className="sr-only" />
            {d === "in" ? "Sumar unidades" : "Restar unidades"}
          </label>
        ))}
      </fieldset>
      <Field label="Cantidad" error={errors.quantity}>
        {(c) => <Input name="quantity" type="number" inputMode="numeric" min={1} step={1} required autoFocus {...c} />}
      </Field>
      <Field label="Motivo" error={errors.reason}>
        {(c) => (
          <Select key={direction} name="reason" defaultValue={reasons[0]} {...c}>
            {reasons.map((r) => (
              <option key={r} value={r}>
                {REASON_LABELS[r]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Nota" hint="Obligatoria en correcciones, pérdidas y «otro»." error={errors.note}>
        {(c) => <Textarea name="note" rows={2} maxLength={300} {...c} />}
      </Field>
      <div className="flex justify-end gap-2 pt-1">
        <DialogClose asChild>
          <Button variant="ghost">Cancelar</Button>
        </DialogClose>
        <SubmitButton pending={pending} pendingLabel="Guardando…">
          Aplicar ajuste
        </SubmitButton>
      </div>
    </form>
  );
}
