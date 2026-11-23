"use client";

import { Archive, CheckCircle2, Circle, EyeOff, Rocket, RotateCcw } from "lucide-react";

import { publishProductAction } from "@/composition/product-actions";
import type { AdminProduct, PublicationIssue } from "@/modules/catalog/contracts";
import { changeStatusAction } from "@/modules/catalog/presentation/actions";
import { ActionDialog } from "@/shared/ui/action-dialog";
import { Button } from "@/shared/ui/button";
import { FormMessage } from "@/shared/ui/form-message";
import { Alert, Card, CardHeader } from "@/shared/ui/surface";
import { SubmitButton } from "@/shared/ui/submit-button";
import { useActionForm } from "@/shared/ui/use-action-form";

const CHECKS = [
  { prefix: "title", label: "Título" },
  { prefix: "short_description", label: "Descripción corta" },
  { prefix: "description", label: "Descripción" },
  { prefix: "category", label: "Categoría activa" },
  { prefix: "colors", label: "Al menos un color activo" },
  { prefix: "primary_color", label: "Color principal" },
  { prefix: "variants", label: "Tallas activas en cada color" },
  { prefix: "cover", label: "Portada en cada color" },
  { prefix: "alt", label: "Texto alternativo de portadas" },
  { prefix: "stock", label: "Stock inicial registrado (puede ser 0)" },
];

export function PublicationPanel({ product, issues }: { product: AdminProduct; issues: PublicationIssue[] }) {
  const { state, onSubmit, pending } = useActionForm(publishProductAction);
  const fields = { productId: product.id, expectedVersion: product.version };
  const ready = issues.length === 0;

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
      <Card>
        <CardHeader title="Requisitos para publicar" description="Un color sin stock puede publicarse: se muestra como agotado." />
        <ul className="divide-y divide-line">
          {CHECKS.map((check) => {
            const related = issues.filter((i) => i.code === check.prefix || i.code.startsWith(`${check.prefix}:`));
            const ok = related.length === 0;
            return (
              <li key={check.prefix} className="flex gap-3 px-6 py-3.5">
                {ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> : <Circle className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />}
                <div>
                  <p className={ok ? "font-semibold" : "font-semibold text-ink"}>
                    {check.label}
                    <span className="sr-only">{ok ? " (completo)" : " (pendiente)"}</span>
                  </p>
                  {related.map((issue) => (
                    <p key={issue.code} className="text-[12px] text-muted">
                      {issue.message}
                    </p>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card className="h-fit p-6">
        <p className="eyebrow mb-2">Estado</p>
        {product.status === "published" ? (
          <div className="flex flex-col gap-4">
            <Alert tone="success" title="Publicado">
              Visible en la tienda. Los cambios de precio y stock se reflejan en pocos minutos.
            </Alert>
            <ActionDialog
              action={changeStatusAction}
              fields={{ ...fields, to: "draft" }}
              title="Pasar a borrador"
              description="Dejará de mostrarse en la tienda. Los pedidos existentes no cambian."
              confirmLabel="Pasar a borrador"
              trigger={
                <Button variant="secondary" block>
                  <EyeOff aria-hidden /> Pasar a borrador
                </Button>
              }
            />
          </div>
        ) : product.status === "archived" ? (
          <div className="flex flex-col gap-4">
            <Alert tone="warning" title="Archivado">
              No se muestra ni se edita. Sus SKU se conservan para el historial de pedidos.
            </Alert>
            <ActionDialog
              action={changeStatusAction}
              fields={{ ...fields, to: "draft" }}
              title="Restaurar como borrador"
              confirmLabel="Restaurar"
              trigger={
                <Button variant="secondary" block>
                  <RotateCcw aria-hidden /> Restaurar como borrador
                </Button>
              }
            />
          </div>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <input type="hidden" name="productId" value={product.id} />
            <input type="hidden" name="expectedVersion" value={product.version} />
            <Alert tone="info" title="Borrador">
              No visible en la tienda.
            </Alert>
            {state.status === "error" ? <FormMessage state={state} /> : null}
            <SubmitButton size="lg" block disabled={!ready} pending={pending} pendingLabel="Publicando…">
              <Rocket aria-hidden /> Publicar
            </SubmitButton>
            {!ready ? <p className="text-center text-[12px] text-muted">Completa los requisitos pendientes.</p> : null}
          </form>
        )}
        {product.status !== "archived" ? (
          <div className="mt-6 border-t border-line pt-5">
            <ActionDialog
              action={changeStatusAction}
              fields={{ ...fields, to: "archived" }}
              title="Archivar producto"
              description="Se oculta de la tienda y del trabajo diario. Puedes restaurarlo después."
              confirmLabel="Archivar"
              tone="danger"
              trigger={
                <Button variant="ghost" block className="text-sale hover:bg-sale/10">
                  <Archive aria-hidden /> Archivar
                </Button>
              }
            />
          </div>
        ) : null}
      </Card>
    </div>
  );
}
