"use client";

import Image from "next/image";
import { useState } from "react";

import { saveStoreGeneralAction } from "@/composition/storefront-actions";
import { Button } from "@/shared/ui/button";
import { Field, Input, Select, Textarea } from "@/shared/ui/form";
import { FormMessage } from "@/shared/ui/form-message";
import { Card } from "@/shared/ui/surface";
import { useActionForm } from "@/shared/ui/use-action-form";

import type { GeneralSettings, SectionSnapshot, WelcomeOffer } from "../contracts";

export function GeneralSettingsEditor({ section, images = [], assetBase = "", operationKey: initialKey }: { section: SectionSnapshot<"general">; images?: string[]; assetBase?: string; operationKey: string }) {
  const [data, setData] = useState(section.data);
  const [operationKey] = useState(initialKey);
  const { state, onSubmit, pending } = useActionForm(saveStoreGeneralAction);
  function field(key: keyof GeneralSettings, label: string, options: { hint?: string; maxLength?: number; inputMode?: "tel" | "email" | "numeric"; type?: "text" | "email" | "url" } = {}) {
    return <Field label={label} hint={options.hint}>{(a) => <Input {...a} value={String(data[key] as string | boolean)} onChange={(e) => setData({ ...data, [key]: e.target.value })} maxLength={options.maxLength ?? 150} inputMode={options.inputMode} type={options.type ?? "text"} />}</Field>;
  }
  const offer = data.welcomeOffer;
  const setOffer = (change: Partial<WelcomeOffer>) => setData({ ...data, welcomeOffer: { ...offer, ...change } });
  function offerField(key: "eyebrow" | "title" | "code" | "buttonLabel" | "terms", label: string, maxLength: number, hint?: string) {
    return <Field label={label} hint={hint}>{(a) => <Input {...a} value={offer[key]} maxLength={maxLength} onChange={(e) => setOffer({ [key]: key === "code" ? e.target.value.toUpperCase() : e.target.value })} />}</Field>;
  }
  return <Card className="p-5 md:p-7"><form aria-label="Configuración general" onSubmit={onSubmit} className="space-y-7" noValidate>
    <input type="hidden" name="data" value={JSON.stringify(data)} /><input type="hidden" name="operationKey" value={operationKey} /><input type="hidden" name="expectedVersion" value={section.version} />
    <fieldset className="space-y-4"><legend className="mb-4 text-lg font-black">WhatsApp</legend>
      <div className="grid gap-4 md:grid-cols-2">
        {field("orderWhatsapp", "WhatsApp de pedidos", { inputMode: "tel", maxLength: 40, hint: "Recibe las solicitudes del carrito. Incluye código de país (+51 para Perú). Vacío deshabilita solicitudes nuevas." })}
        {field("contactWhatsapp", "WhatsApp de atención", { inputMode: "tel", maxLength: 40, hint: "Se publica en los contactos y en el botón flotante. Puede ser el mismo número de pedidos." })}
      </div>
      <Button type="button" size="sm" variant="secondary" onClick={() => setData({ ...data, contactWhatsapp: data.orderWhatsapp })}>Usar el número de pedidos para atención</Button>
      <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={data.floatingWhatsapp} onChange={(e) => setData({ ...data, floatingWhatsapp: e.target.checked })} /> Mostrar botón flotante en la página principal</label>
      {!data.contactWhatsapp ? <p className="text-xs text-muted">El botón aparecerá cuando guardes un número de atención.</p> : null}
    </fieldset>
    <fieldset className="space-y-4 border-t border-line pt-6"><legend className="mb-4 text-lg font-black">Correo y redes sociales</legend>
      <div className="grid gap-4 md:grid-cols-2">
        {field("email", "Correo de atención", { type: "email", inputMode: "email", maxLength: 254 })}
        {field("instagramUrl", "Instagram", { type: "url", maxLength: 300, hint: "URL completa de tu perfil HTTPS." })}
        {field("tiktokUrl", "TikTok", { type: "url", maxLength: 300, hint: "URL completa de tu perfil HTTPS." })}
      </div>
      <p className="text-xs text-muted">Deja vacío cualquier contacto que no quieras mostrar en la tienda.</p>
    </fieldset>
    <fieldset className="space-y-4 border-t border-line pt-6"><legend className="mb-4 text-lg font-black">Datos del negocio</legend>
      <div className="grid gap-4 md:grid-cols-2">
        {field("businessName", "Nombre comercial", { maxLength: 100 })}
        {field("legalName", "Razón social (opcional)")}
        {field("taxId", "RUC (opcional)", { inputMode: "numeric", maxLength: 11 })}
        {field("location", "Ciudad y país (opcional)")}
        {field("address", "Dirección pública (opcional)", { maxLength: 250 })}
        {field("openingHours", "Horario de atención (opcional)", { maxLength: 250 })}
      </div>
      <p className="text-xs text-muted">Estos datos se muestran en el pie de página al guardar. Completa solo la información que quieras publicar.</p>
    </fieldset>
    <fieldset className="space-y-4 border-t border-line pt-6"><legend className="mb-4 text-lg font-black">Descuento de bienvenida</legend>
      <p className="text-sm text-muted">Ventana que aparece una vez a cada visitante con un código. El código viaja en la solicitud de WhatsApp; el descuento se aplica al coordinar el pedido.</p>
      <label className="flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={offer.enabled} onChange={(e) => setOffer({ enabled: e.target.checked })} /> Mostrar el descuento de bienvenida</label>
      <div className="grid gap-4 md:grid-cols-2">
        {offerField("eyebrow", "Antetítulo", 60)}
        {offerField("title", "Título", 80)}
        {offerField("code", "Código", 30, "Letras, números o guiones. Si lo cambias, quien ya lo vio verá el nuevo.")}
        {offerField("buttonLabel", "Texto del botón", 40)}
        <Field label="Descripción">{(a) => <Textarea {...a} value={offer.text} maxLength={240} rows={3} onChange={(e) => setOffer({ text: e.target.value })} />}</Field>
        {offerField("terms", "Condiciones", 200)}
        <Field label="Imagen (opcional)" hint="De la biblioteca de la tienda. Sin imagen, la ventana se muestra solo con texto.">{(a) => <Select {...a} value={offer.imageKey} onChange={(e) => setOffer({ imageKey: e.target.value })}><option value="">Sin imagen</option>{images.map((key) => <option key={key} value={key}>{key}</option>)}</Select>}</Field>
        {offer.imageKey ? <span className="relative block h-32 overflow-hidden rounded-xl"><Image src={assetBase + offer.imageKey} alt="" fill sizes="320px" className="object-cover" /></span> : null}
      </div>
    </fieldset>
    <FormMessage state={state} />
    <Button type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar configuración general"}</Button>
  </form></Card>;
}
