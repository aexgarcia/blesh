import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { requireAdminActor } from "@/modules/identity/server";
import { Logo } from "@/shared/ui/brand";
import { SidebarShell } from "@/shared/ui/sidebar-shell";
import { Toaster } from "@/shared/ui/toaster";

import { AdminNav, AdminNavFallback, AdminUserMenu } from "./_components/admin-chrome";

export const metadata: Metadata = {
  title: { default: "Administración", template: "%s | Administración BLESH" },
  robots: { index: false, follow: false },
};

/**
 * Verifica la sesión antes de renderizar contenido administrativo.
 * Cada página vuelve a llamar `requireAdminActor()`: el layout no protege por sí solo.
 */
async function AdminGate({ children }: { children: React.ReactNode }) {
  await requireAdminActor();
  return <>{children}</>;
}

function ContentFallback() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Cargando">
      <div className="h-10 w-56 animate-pulse rounded-full bg-card" />
      <div className="h-64 animate-pulse rounded-card bg-card/70" />
    </div>
  );
}

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <>
      <SidebarShell
        brand={
          <Link href="/admin/pedidos" aria-label="BLESH administración, ir a Pedidos">
            <Logo tone="white" alt="" className="h-7" preload />
          </Link>
        }
        nav={
          <Suspense fallback={<AdminNavFallback />}>
            <AdminNav />
          </Suspense>
        }
        footer={
          <Suspense fallback={<div className="h-9" />}>
            <AdminUserMenu />
          </Suspense>
        }
      >
        <Suspense fallback={<ContentFallback />}>
          <AdminGate>{children}</AdminGate>
        </Suspense>
      </SidebarShell>
      <Toaster />
    </>
  );
}
