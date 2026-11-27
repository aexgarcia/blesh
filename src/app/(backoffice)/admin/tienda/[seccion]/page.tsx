import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { getStorefrontGeneralEditor, getStorefrontLibrary, getStorefrontPackEditor, getStorefrontReelsEditor, getStorefrontVisualEditor } from "@/composition/storefront-admin";
import { GeneralSettingsEditor } from "@/modules/content/presentation/general-settings-editor";
import { HeroEditor, CollectionsEditor } from "@/modules/content/presentation/home-visual-editor";
import { PackEditor, ReelsEditor, UploadAsset } from "@/modules/content/presentation/storefront-editor";
import { StorefrontLibrary } from "@/modules/content/presentation/storefront-library";
import { STOREFRONT_SETTINGS } from "@/modules/content/presentation/storefront-navigation";
import { actorCan, requireAdminActor } from "@/modules/identity/server";
import { CardSkeleton } from "@/shared/ui/skeleton";
import { Card, PageHeader } from "@/shared/ui/surface";

export function generateStaticParams() { return STOREFRONT_SETTINGS.map(({ slug }) => ({ seccion: slug })); }
export const metadata: Metadata = { title: "Configuración de tienda" };

async function Editor({ params }: PageProps<"/admin/tienda/[seccion]">) {
  const actor = await requireAdminActor();
  if (!actorCan(actor, "content.manage")) return <Card className="p-6">Solo el propietario puede configurar la tienda.</Card>;
  const { seccion } = await params;
  const section = STOREFRONT_SETTINGS.find((item) => item.slug === seccion);
  if (!section) notFound();
  let editor;
  if (seccion === "general") {
    const data = await getStorefrontGeneralEditor(actor);
    editor = <GeneralSettingsEditor key={data.section.version} section={data.section} images={data.images} assetBase={data.assetBase} operationKey={randomUUID()} />;
  } else if (seccion === "portada" || seccion === "colecciones") {
    const { sections, options } = await getStorefrontVisualEditor(actor);
    editor = seccion === "portada" ? <HeroEditor key={sections.hero.version} section={sections.hero} options={options} operationKey={randomUUID()} /> : <CollectionsEditor key={sections.collections.version} section={sections.collections} options={options} operationKey={randomUUID()} />;
  } else if (seccion === "pack") {
    const data = await getStorefrontPackEditor(actor);
    editor = <PackEditor key={`${data.section.version}:${data.pack.version}`} {...data} operationKey={randomUUID()} />;
  } else if (seccion === "movimiento") {
    const data = await getStorefrontReelsEditor(actor);
    editor = <ReelsEditor key={data.section.version} {...data} operationKey={randomUUID()} />;
  } else {
    const data = await getStorefrontLibrary(actor);
    editor = <div className="space-y-6"><UploadAsset /><StorefrontLibrary {...data} /></div>;
  }
  return <><PageHeader eyebrow="Tienda" title={section.label} description={section.description} />
    {seccion !== "biblioteca" ? <p className="mb-5 text-sm text-muted">Los cambios se publican al guardar esta sección. {seccion !== "general" ? <Link href="/admin/tienda/biblioteca" target="_blank" rel="noopener noreferrer" className="font-semibold text-ink underline">Abrir biblioteca ↗</Link> : null}</p> : null}
    {editor}</>;
}

export default function StorefrontSectionPage(props: PageProps<"/admin/tienda/[seccion]">) {
  return <Suspense fallback={<CardSkeleton rows={6} />}><Editor {...props} /></Suspense>;
}
