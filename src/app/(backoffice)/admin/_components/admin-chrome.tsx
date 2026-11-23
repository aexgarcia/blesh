import { KeyRound, LogOut, Package, ShoppingBag, Users } from "lucide-react";

import { ROLE_LABELS } from "@/modules/identity/contracts";
import { signOutAction } from "@/modules/identity/presentation/auth-actions";
import { actorCan, getAdminSessionState } from "@/modules/identity/server";
import { SidebarLink, SidebarLinkStatic } from "@/shared/ui/nav-link";

// Navegación V1 aprobada. Sin dashboard, importación, CMS ni configuración visual.
const SECTIONS = [
  { href: "/admin/pedidos", label: "Pedidos", icon: <ShoppingBag aria-hidden /> },
  { href: "/admin/productos", label: "Productos", icon: <Package aria-hidden /> },
  { href: "/admin/clientes", label: "Clientes", icon: <Users aria-hidden /> },
] as const;

export function AdminNavFallback() {
  return SECTIONS.map((s) => (
    <SidebarLinkStatic key={s.href} href={s.href} icon={s.icon}>
      {s.label}
    </SidebarLinkStatic>
  ));
}

/** Navegación según rol: Gestión de acceso solo para propietarios (el servidor lo vuelve a comprobar). */
export async function AdminNav() {
  const state = await getAdminSessionState();
  const canManageAccess = state.kind === "ok" && actorCan(state.actor, "access.manage");
  return (
    <>
      {SECTIONS.map((s) => (
        <SidebarLink key={s.href} href={s.href} icon={s.icon}>
          {s.label}
        </SidebarLink>
      ))}
      {canManageAccess ? (
        <SidebarLink href="/admin/acceso" icon={<KeyRound aria-hidden />}>
          Gestión de acceso
        </SidebarLink>
      ) : null}
    </>
  );
}

export async function AdminUserMenu() {
  const state = await getAdminSessionState();
  if (state.kind !== "ok") return null;
  const { actor } = state;
  const initials = actor.displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  return (
    <div className="flex items-center gap-3">
      <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-violet text-[12px] font-extrabold text-white">
        {initials}
      </span>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-[13px] font-bold text-ink md:text-white">{actor.displayName}</p>
        <p className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-muted md:text-white/50">{ROLE_LABELS[actor.role]}</p>
      </div>
      <form action={signOutAction}>
        <button
          type="submit"
          aria-label="Cerrar sesión"
          title="Cerrar sesión"
          className="grid size-9 place-items-center rounded-full text-muted transition-colors hover:bg-black/5 hover:text-ink md:text-white/60 md:hover:bg-white/10 md:hover:text-white"
        >
          <LogOut className="size-4" aria-hidden />
        </button>
      </form>
    </div>
  );
}
