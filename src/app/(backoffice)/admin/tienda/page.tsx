import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { STOREFRONT_SETTINGS, storefrontSettingHref } from "@/modules/content/presentation/storefront-navigation";
import { actorCan, requireAdminActor } from "@/modules/identity/server";
import { CardSkeleton } from "@/shared/ui/skeleton";
import { Card, PageHeader } from "@/shared/ui/surface";

export const metadata: Metadata = { title: "Tienda" };

async function Editor() {
  const actor = await requireAdminActor();
  if (!actorCan(actor, "content.manage")) return <Card className="p-6">Solo el propietario puede configurar la tienda.</Card>;
  return <><PageHeader eyebrow="Configuración" title="Tienda" description="Elige la sección que quieres editar. Cada una se guarda y publica por separado." />
    <div className="grid gap-4 sm:grid-cols-2">{STOREFRONT_SETTINGS.map((section, index) => <Link key={section.slug} href={storefrontSettingHref(section.slug)} className="group rounded-card border border-line bg-surface p-6 transition-colors hover:border-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink">
      <span className="text-[11px] font-extrabold text-muted">0{index + 1}</span>
      <h2 className="mt-3 text-xl font-black">{section.label} <span aria-hidden className="inline-block transition-transform group-hover:translate-x-1">→</span></h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">{section.description}</p>
    </Link>)}</div></>;
}

export default function StorefrontSettingsPage() {
  return <Suspense fallback={<CardSkeleton rows={6} />}><Editor /></Suspense>;
}
