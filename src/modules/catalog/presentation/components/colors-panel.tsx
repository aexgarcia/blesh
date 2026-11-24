"use client";

import { Pencil, Plus, Star } from "lucide-react";
import { useState } from "react";

import { formatPEN, minorToInput } from "@/shared/domain/money";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/shared/ui/dialog";
import { Field, Input, Select } from "@/shared/ui/form";
import { FormMessage } from "@/shared/ui/form-message";
import { Badge, Card, EmptyState } from "@/shared/ui/surface";
import { SubmitButton } from "@/shared/ui/submit-button";
import { TBody, THead, Table, Td, Th, Tr } from "@/shared/ui/table";
import { useActionForm } from "@/shared/ui/use-action-form";

import { SIZE_CODES, SIZE_LABELS, type AdminColor, type AdminProduct, type AdminVariant } from "../../contracts";
import { addColorAction, addVariantAction, setPrimaryColorAction, updateColorAction, updateVariantAction } from "../actions";

export function ColorsPanel({ product }: { product: AdminProduct }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-[13px] text-muted">
          Cada color tiene su propia tarjeta y página en la tienda. Cada talla de un color es una variante con SKU, precio y stock propios.
        </p>
        <ColorDialog productId={product.id} />
      </div>
      {product.colors.length === 0 ? (
        <Card>
          <EmptyState title="Sin colores" description="Agrega el primer color (por ejemplo «Negro»). Si la prenda no tiene variantes de color, usa «Único»." />
        </Card>
      ) : (
        product.colors.map((color) => (
          <ColorCard key={color.id} product={product} color={color} variants={product.variants.filter((v) => v.colorId === color.id)} />
        ))
      )}
    </div>
  );
}

function ColorCard({ product, color, variants }: { product: AdminProduct; color: AdminColor; variants: AdminVariant[] }) {
  const primary = useActionForm(setPrimaryColorAction);
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-6 py-4">
        <div className="flex items-center gap-3">
          <span aria-hidden className="size-7 rounded-full border border-line" style={{ background: color.swatchHex ?? "var(--card)" }} />
          <div>
            <p className="flex items-center gap-2 font-extrabold">
              {color.label}
              {color.isPrimary ? <Badge tone="ink">Principal</Badge> : null}
              {!color.active ? <Badge>Inactivo</Badge> : null}
            </p>
            <p className="text-[12px] text-muted">
              /productos/{product.slug}/{color.slug}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!color.isPrimary && color.active ? (
            <form onSubmit={primary.onSubmit}>
              <input type="hidden" name="productId" value={product.id} />
              <input type="hidden" name="colorId" value={color.id} />
              <SubmitButton variant="ghost" size="sm" pending={primary.pending}>
                <Star aria-hidden /> Hacer principal
              </SubmitButton>
            </form>
          ) : null}
          <ColorDialog productId={product.id} color={color} slugLocked={product.slugLocked} />
          <VariantDialog productId={product.id} colorId={color.id} usedSizes={variants.map((v) => v.sizeCode)} suggestedSku={`${product.slug}-${color.colorCode}`} />
        </div>
      </div>
      {primary.state.status === "error" ? <FormMessage state={primary.state} className="m-4" /> : null}
      {variants.length === 0 ? (
        <p className="px-6 py-5 text-[13px] text-muted">Sin tallas. Agrega al menos una para poder publicar este color.</p>
      ) : (
        <Table>
          <THead>
            <Tr>
              <Th>Talla</Th>
              <Th>SKU</Th>
              <Th>Precio</Th>
              <Th>Precio anterior</Th>
              <Th>Estado</Th>
              <Th className="text-right">
                <span className="sr-only">Acciones</span>
              </Th>
            </Tr>
          </THead>
          <TBody>
            {variants.map((v) => (
              <Tr key={v.id}>
                <Td className="font-extrabold">{SIZE_LABELS[v.sizeCode]}</Td>
                <Td className="font-mono text-[12px]">{v.sku}</Td>
                <Td>{formatPEN(v.priceMinor)}</Td>
                <Td className="text-muted">{v.compareAtMinor ? <s>{formatPEN(v.compareAtMinor)}</s> : "—"}</Td>
                <Td>{v.active ? <Badge tone="success">Activa</Badge> : <Badge>Inactiva</Badge>}</Td>
                <Td className="text-right">
                  <VariantDialog productId={product.id} colorId={color.id} variant={v} />
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
    </Card>
  );
}

// ---------- Color ----------

type ColorFormProps = { productId: string; color?: AdminColor; slugLocked?: boolean };

function ColorDialog(props: ColorFormProps) {
  const [open, setOpen] = useState(false);
  const { color } = props;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {color ? (
          <Button variant="ghost" size="sm">
            <Pencil aria-hidden /> Editar color
          </Button>
        ) : (
          <Button size="lg">
            <Plus aria-hidden /> Agregar color
          </Button>
        )}
      </DialogTrigger>
      <DialogContent title={color ? `Editar ${color.label}` : "Nuevo color"} description="El nombre se muestra en la tienda y forma la URL del color.">
        <ColorForm {...props} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function ColorForm({ productId, color, slugLocked, onDone }: ColorFormProps & { onDone: () => void }) {
  const { state, onSubmit, pending } = useActionForm(color ? updateColorAction : addColorAction, { onSuccess: onDone });
  const errors = state.fieldErrors ?? {};
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="productId" value={productId} />
      {color ? <input type="hidden" name="colorId" value={color.id} /> : null}
      {state.status === "error" ? <FormMessage state={state} /> : null}
      <Field label="Nombre" hint={color && slugLocked ? "La URL del color quedó fija al publicar." : undefined} error={errors.label}>
        {(c) => <Input name="label" defaultValue={color?.label} maxLength={40} required placeholder="Negro" autoFocus {...c} />}
      </Field>
      <Field label="Muestra de color (opcional)" hint="Hexadecimal, p. ej. #1c1c1c" error={errors.swatchHex}>
        {(c) => <Input name="swatchHex" defaultValue={color?.swatchHex ?? ""} maxLength={7} placeholder="#1c1c1c" {...c} />}
      </Field>
      <label className="flex items-center gap-3 text-[13px] font-semibold">
        <input type="checkbox" name="active" defaultChecked={color?.active ?? true} className="size-4 accent-ink" />
        Activo (visible al publicar)
      </label>
      <div className="flex justify-end gap-2 pt-1">
        <DialogClose asChild>
          <Button variant="ghost">Cancelar</Button>
        </DialogClose>
        <SubmitButton pending={pending} pendingLabel="Guardando…">
          {color ? "Guardar" : "Agregar color"}
        </SubmitButton>
      </div>
    </form>
  );
}

// ---------- Variante (talla) ----------

type VariantFormProps = { productId: string; colorId: string; variant?: AdminVariant; usedSizes?: string[]; suggestedSku?: string };

function VariantDialog(props: VariantFormProps) {
  const [open, setOpen] = useState(false);
  const { variant, usedSizes = [] } = props;
  const remaining = SIZE_CODES.filter((s) => !usedSizes.includes(s));
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant ? (
          <Button variant="ghost" size="icon" aria-label={`Editar talla ${SIZE_LABELS[variant.sizeCode]}`}>
            <Pencil aria-hidden />
          </Button>
        ) : (
          <Button variant="secondary" size="sm" disabled={remaining.length === 0}>
            <Plus aria-hidden /> Talla
          </Button>
        )}
      </DialogTrigger>
      <DialogContent title={variant ? `Talla ${SIZE_LABELS[variant.sizeCode]}` : "Nueva talla"} description="Precios en soles. El precio anterior es solo informativo (tachado).">
        <VariantForm {...props} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

/** Se monta en cada apertura: la talla sugerida y el SKU parten de las tallas aún libres. */
function VariantForm({ productId, colorId, variant, usedSizes = [], suggestedSku, onDone }: VariantFormProps & { onDone: () => void }) {
  const { state, onSubmit, pending } = useActionForm(variant ? updateVariantAction : addVariantAction, { onSuccess: onDone });
  const available = SIZE_CODES.filter((s) => !usedSizes.includes(s));
  // Sugerir la primera talla libre en orden S → M → L …, luego el resto.
  const preferred = (["S", "M", "L", "XL", "XXL", "XS", "UNICA"] as const).find((s) => available.includes(s)) ?? available[0];
  const [size, setSize] = useState<string>(preferred ?? "");
  const [sku, setSku] = useState(variant?.sku ?? (suggestedSku && preferred ? `${suggestedSku}-${preferred}`.toUpperCase().slice(0, 40) : ""));
  const [skuTouched, setSkuTouched] = useState(Boolean(variant));
  const errors = state.fieldErrors ?? {};

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="productId" value={productId} />
      {variant ? (
        <>
          <input type="hidden" name="variantId" value={variant.id} />
          <input type="hidden" name="expectedVersion" value={variant.version} />
        </>
      ) : (
        <input type="hidden" name="colorId" value={colorId} />
      )}
      {state.status === "error" ? <FormMessage state={state} /> : null}
      {!variant ? (
        <Field label="Talla" error={errors.sizeCode}>
          {(c) => (
            <Select
              name="sizeCode"
              value={size}
              onChange={(e) => {
                setSize(e.target.value);
                if (!skuTouched && suggestedSku) setSku(`${suggestedSku}-${e.target.value}`.toUpperCase().slice(0, 40));
              }}
              {...c}
            >
              {available.map((s) => (
                <option key={s} value={s}>
                  {SIZE_LABELS[s]}
                </option>
              ))}
            </Select>
          )}
        </Field>
      ) : null}
      <Field label="SKU" hint="Código único: letras, números y guiones." error={errors.sku}>
        {(c) => (
          <Input
            name="sku"
            value={sku}
            onChange={(e) => {
              setSkuTouched(true);
              setSku(e.target.value.toUpperCase());
            }}
            maxLength={40}
            required
            className="font-mono uppercase"
            {...c}
          />
        )}
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Precio (S/)" error={errors.price}>
          {(c) => <Input name="price" inputMode="decimal" defaultValue={variant ? minorToInput(variant.priceMinor) : ""} placeholder="70.00" required autoFocus={Boolean(variant)} {...c} />}
        </Field>
        <Field label="Precio anterior" error={errors.compareAt}>
          {(c) => <Input name="compareAt" inputMode="decimal" defaultValue={variant?.compareAtMinor ? minorToInput(variant.compareAtMinor) : ""} placeholder="Opcional" {...c} />}
        </Field>
      </div>
      <label className="flex items-center gap-3 text-[13px] font-semibold">
        <input type="checkbox" name="active" defaultChecked={variant?.active ?? true} className="size-4 accent-ink" />
        Activa (se puede vender)
      </label>
      <div className="flex justify-end gap-2 pt-1">
        <DialogClose asChild>
          <Button variant="ghost">Cancelar</Button>
        </DialogClose>
        <SubmitButton pending={pending} pendingLabel="Guardando…">
          {variant ? "Guardar" : "Agregar talla"}
        </SubmitButton>
      </div>
    </form>
  );
}
