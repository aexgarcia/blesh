"use client";

import { Ban, LogOut, MailPlus, MoreHorizontal, ShieldOff, UserCheck, UserCog, XCircle } from "lucide-react";
import { useState } from "react";

import { formatLimaDate } from "@/shared/domain/dates";
import { ActionDialog } from "@/shared/ui/action-dialog";
import { Button } from "@/shared/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import { Field, Select } from "@/shared/ui/form";
import { Badge } from "@/shared/ui/surface";
import { TBody, THead, Table, Td, Th, Tr } from "@/shared/ui/table";

import { ROLE_LABELS, STATUS_LABELS, type AdminUserSummary } from "../../contracts";
import {
  cancelInvitationAction,
  changeRoleAction,
  deactivateAdminAction,
  reactivateAdminAction,
  resendInvitationAction,
  resetMfaAction,
  revokeSessionsAction,
} from "../access-actions";

const STATUS_TONE = { active: "success", invited: "violet", disabled: "neutral" } as const;

export function MembersTable({ users }: { users: AdminUserSummary[] }) {
  return (
    <Table>
      <THead>
        <Tr>
          <Th>Usuario</Th>
          <Th>Rol</Th>
          <Th>Estado</Th>
          <Th>Verificación 2 pasos</Th>
          <Th>Alta</Th>
          <Th className="text-right">
            <span className="sr-only">Acciones</span>
          </Th>
        </Tr>
      </THead>
      <TBody>
        {users.map((user) => (
          <Tr key={user.membershipId}>
            <Td>
              <div className="flex items-center gap-3">
                <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-card text-[12px] font-extrabold">
                  {user.displayName.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-bold">
                    {user.displayName}
                    {user.isCurrentUser ? <span className="ml-2 text-[11px] font-semibold text-muted">(tú)</span> : null}
                  </p>
                  <p className="truncate text-[12px] text-muted">{user.email}</p>
                </div>
              </div>
            </Td>
            <Td>
              <Badge tone={user.role === "owner" ? "ink" : "neutral"}>{ROLE_LABELS[user.role]}</Badge>
            </Td>
            <Td>
              <Badge tone={STATUS_TONE[user.status]}>{STATUS_LABELS[user.status]}</Badge>
            </Td>
            <Td>
              {user.mfaEnrolled === null ? (
                <Badge tone="warning">Sin datos</Badge>
              ) : user.mfaEnrolled ? (
                <Badge tone="success">Configurada</Badge>
              ) : (
                <Badge tone="neutral">Pendiente</Badge>
              )}
            </Td>
            <Td className="whitespace-nowrap text-muted">
              {user.activatedAt ? formatLimaDate(new Date(user.activatedAt)) : `Invitado ${formatLimaDate(new Date(user.invitedAt))}`}
            </Td>
            <Td className="text-right">
              <MemberActions user={user} />
            </Td>
          </Tr>
        ))}
      </TBody>
    </Table>
  );
}

type DialogKind = "role" | "deactivate" | "reactivate" | "revoke" | "mfa" | "cancel" | "resend" | null;

/** Acciones por fila. La disponibilidad aquí es orientativa: el servidor aplica las reglas. */
function MemberActions({ user }: { user: AdminUserSummary }) {
  const [dialog, setDialog] = useState<DialogKind>(null);
  const ref = { membershipId: user.membershipId };
  const close = (open: boolean) => !open && setDialog(null);
  const self = user.isCurrentUser;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label={`Acciones para ${user.displayName}`}>
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>{user.displayName}</DropdownMenuLabel>
          {user.status === "invited" ? (
            <>
              <DropdownMenuItem onSelect={() => setDialog("resend")}>
                <MailPlus aria-hidden /> Reenviar invitación
              </DropdownMenuItem>
              <DropdownMenuItem tone="danger" onSelect={() => setDialog("cancel")}>
                <XCircle aria-hidden /> Cancelar invitación
              </DropdownMenuItem>
            </>
          ) : (
            <>
              <DropdownMenuItem disabled={self} onSelect={() => setDialog("role")}>
                <UserCog aria-hidden /> Cambiar rol
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setDialog("revoke")}>
                <LogOut aria-hidden /> Cerrar sus sesiones
              </DropdownMenuItem>
              <DropdownMenuItem disabled={self} onSelect={() => setDialog("mfa")}>
                <ShieldOff aria-hidden /> Restablecer verificación
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {user.status === "disabled" ? (
                <DropdownMenuItem onSelect={() => setDialog("reactivate")}>
                  <UserCheck aria-hidden /> Reactivar
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem tone="danger" disabled={self} onSelect={() => setDialog("deactivate")}>
                  <Ban aria-hidden /> Desactivar
                </DropdownMenuItem>
              )}
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <VersionedDialogs user={user} dialog={dialog} close={close} refFields={ref} />
    </>
  );
}

function VersionedDialogs({ user, dialog, close, refFields }: {
  user: AdminUserSummary;
  dialog: DialogKind;
  close: (open: boolean) => void;
  refFields: { membershipId: string };
}) {
  const versioned = { ...refFields, expectedVersion: user.version };
  return (
    <>
      <ActionDialog
        open={dialog === "role"}
        onOpenChange={close}
        action={changeRoleAction}
        fields={versioned}
        title="Cambiar rol"
        description={`Se cerrarán las sesiones abiertas de ${user.displayName} para aplicar los nuevos permisos.`}
        confirmLabel="Guardar rol"
      >
        <Field label="Rol">
          {(c) => (
            <Select name="role" defaultValue={user.role} {...c}>
              <option value="operator">Operador</option>
              <option value="owner">Propietario</option>
            </Select>
          )}
        </Field>
      </ActionDialog>
      <ActionDialog
        open={dialog === "deactivate"}
        onOpenChange={close}
        action={deactivateAdminAction}
        fields={versioned}
        title={`Desactivar a ${user.displayName}`}
        description="Perderá el acceso de inmediato, incluso en sesiones ya abiertas. Podrás reactivarlo después."
        confirmLabel="Desactivar"
        tone="danger"
        reason={{ label: "Motivo (opcional)" }}
      />
      <ActionDialog
        open={dialog === "reactivate"}
        onOpenChange={close}
        action={reactivateAdminAction}
        fields={versioned}
        title={`Reactivar a ${user.displayName}`}
        description="Podrá volver a iniciar sesión con su contraseña y verificación en dos pasos."
        confirmLabel="Reactivar"
      />
      <ActionDialog
        open={dialog === "revoke"}
        onOpenChange={close}
        action={revokeSessionsAction}
        fields={refFields}
        title="Cerrar todas sus sesiones"
        description={user.isCurrentUser ? "También se cerrará tu sesión actual." : "Deberá iniciar sesión de nuevo en todos sus dispositivos."}
        confirmLabel="Cerrar sesiones"
      />
      <ActionDialog
        open={dialog === "mfa"}
        onOpenChange={close}
        action={resetMfaAction}
        fields={refFields}
        title="Restablecer verificación en dos pasos"
        description="Usa esta opción solo tras confirmar la identidad de la persona por otro medio. Deberá configurar una nueva app al iniciar sesión."
        confirmLabel="Restablecer"
        tone="danger"
        reason={{ label: "Motivo", required: true, hint: "Queda registrado en la auditoría." }}
      />
      <ActionDialog
        open={dialog === "cancel"}
        onOpenChange={close}
        action={cancelInvitationAction}
        fields={refFields}
        title="Cancelar invitación"
        description={`El enlace enviado a ${user.email} dejará de funcionar.`}
        confirmLabel="Cancelar invitación"
        tone="danger"
      />
      <ActionDialog
        open={dialog === "resend"}
        onOpenChange={close}
        action={resendInvitationAction}
        fields={refFields}
        title="Reenviar invitación"
        description={`Se enviará un enlace nuevo a ${user.email}; el anterior quedará inválido.`}
        confirmLabel="Reenviar"
      />
    </>
  );
}
