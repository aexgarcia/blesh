import { Lock, ShieldCheck, Users } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";

import { InviteDialog } from "@/modules/identity/presentation/components/invite-dialog";
import { MembersTable } from "@/modules/identity/presentation/components/members-table";
import { actorCan, listAdminUsers, requireAdminActor } from "@/modules/identity/server";
import { CardSkeleton } from "@/shared/ui/skeleton";
import { Alert, Card, CardHeader, EmptyState, PageHeader } from "@/shared/ui/surface";

export const metadata: Metadata = { title: "Gestión de acceso" };

/** El encabezado es estático (instantáneo); usuarios y permisos llegan tras Suspense. */
export default function AdminAccessPage() {
  return (
    <>
      <PageHeader
        eyebrow="Seguridad"
        title="Gestión de acceso"
        description="Cuentas personales del equipo, roles y sesiones. La verificación en dos pasos es obligatoria."
      />
      <Suspense fallback={<CardSkeleton rows={2} />}>
        <AccessContent />
      </Suspense>
      <RoleGuide />
    </>
  );
}

async function AccessContent() {
  const actor = await requireAdminActor();
  if (!actorCan(actor, "access.manage")) {
    return (
      <Card>
        <EmptyState icon={<Lock />} title="Sin permiso" description="Solo un propietario puede gestionar el acceso administrativo." />
      </Card>
    );
  }
  const result = await listAdminUsers(actor);
  return (
    <Card>
      <CardHeader title="Usuarios" description="Propietarios y operadores con acceso al panel." actions={<InviteDialog />} />
      {!result.ok ? (
        <div className="p-6">
          <Alert tone="danger">{result.message}</Alert>
        </div>
      ) : result.value.length === 0 ? (
        <EmptyState icon={<Users />} title="Aún no hay usuarios" />
      ) : (
        <MembersTable users={result.value} />
      )}
    </Card>
  );
}

function RoleGuide() {
  return (
    <div className="mt-6 grid gap-4 md:grid-cols-2">
      <Card className="p-6">
        <p className="mb-2 flex items-center gap-2 font-extrabold">
          <ShieldCheck className="size-4" aria-hidden /> Propietario
        </p>
        <p className="text-[13px] text-muted">
          Todo lo del operador, además de gestionar accesos, autorizar modalidades de cobro, descuentos excepcionales, cancelaciones con pago y reembolsos.
        </p>
      </Card>
      <Card className="p-6">
        <p className="mb-2 flex items-center gap-2 font-extrabold">
          <Users className="size-4" aria-hidden /> Operador
        </p>
        <p className="text-[13px] text-muted">
          Gestiona productos, stock con motivo, clientes y pedidos, y registra pagos verificados según acuerdos ya autorizados.
        </p>
      </Card>
    </div>
  );
}
