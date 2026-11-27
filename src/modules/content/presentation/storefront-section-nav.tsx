"use client";

import { usePathname, useRouter } from "next/navigation";

import { Field, Select } from "@/shared/ui/form";

import { STOREFRONT_SETTINGS, storefrontSettingHref } from "./storefront-navigation";

export function StorefrontSectionNav() {
  const pathname = usePathname();
  const router = useRouter();
  return <div className="mb-6 md:hidden"><Field label="Sección de tienda">{(a) => <Select {...a} value={pathname} onChange={(event) => router.push(event.target.value)}>
    <option value="/admin/tienda">Todas las configuraciones</option>
    {STOREFRONT_SETTINGS.map((section) => <option key={section.slug} value={storefrontSettingHref(section.slug)}>{section.label}</option>)}
  </Select>}</Field></div>;
}
