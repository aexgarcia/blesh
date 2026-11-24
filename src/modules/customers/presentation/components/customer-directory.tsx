"use client";

import { ChevronLeft, ChevronRight, Search, Users } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { formatLimaDate } from "@/shared/domain/dates";
import { Button } from "@/shared/ui/button";
import { Input, Select } from "@/shared/ui/form";
import { Alert, Badge, EmptyState } from "@/shared/ui/surface";
import { TBody, THead, Table, Td, Th, Tr } from "@/shared/ui/table";

import { CUSTOMER_STATUS_LABELS, formatPhone, type CustomerPage, type CustomerStatus } from "../../contracts";
import { searchCustomersAction } from "../actions";

type Query = { search: string; status: CustomerStatus | ""; page: number };

/**
 * Directorio con búsqueda por nombre, teléfono o correo. La búsqueda va por Server Action (POST):
 * los datos de contacto buscados no aparecen en la URL ni en registros de acceso.
 */
export function CustomerDirectory({ initial }: { initial: CustomerPage }) {
  const [data, setData] = useState(initial);
  const [query, setQuery] = useState<Query>({ search: "", status: "active", page: 1 });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function load(next: Query) {
    startTransition(async () => {
      const result = await searchCustomersAction(next);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setError(null);
      setQuery(next);
      setData(result.page);
    });
  }

  function onSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    load({ search: String(form.get("q") ?? ""), status: String(form.get("estado") ?? "") as Query["status"], page: 1 });
  }

  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const filtered = query.search !== "" || query.status !== "active";

  return (
    <div aria-busy={pending}>
      <form className="flex flex-wrap gap-3 border-b border-line p-5" role="search" onSubmit={onSearch}>
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <label htmlFor="q" className="sr-only">
            Buscar
          </label>
          <Input id="q" name="q" placeholder="Nombre, teléfono o correo" className="pl-10" maxLength={80} autoComplete="off" />
        </div>
        <label htmlFor="estado" className="sr-only">
          Estado
        </label>
        <Select id="estado" name="estado" defaultValue="active" className="w-44">
          <option value="active">Activos</option>
          <option value="archived">Archivados</option>
          <option value="">Todos</option>
        </Select>
        <Button type="submit" variant="secondary" size="lg" disabled={pending}>
          {pending ? "Buscando…" : "Buscar"}
        </Button>
      </form>

      {error ? (
        <Alert tone="danger" className="m-5">
          {error}
        </Alert>
      ) : null}

      {data.rows.length === 0 ? (
        <EmptyState
          icon={<Users />}
          title={filtered ? "Sin resultados" : "Aún no hay clientes"}
          description={
            filtered
              ? "Prueba con otro nombre o con parte del número."
              : "Crea fichas al atender por WhatsApp o en tienda. Al confirmar pedidos también podrás crear o elegir la ficha."
          }
        />
      ) : (
        <div className={pending ? "opacity-60 transition-opacity" : "transition-opacity"}>
          <Table>
            <THead>
              <Tr>
                <Th>Cliente</Th>
                <Th>Teléfono</Th>
                <Th>Correo</Th>
                <Th>Estado</Th>
                <Th>Actualizado</Th>
              </Tr>
            </THead>
            <TBody>
              {data.rows.map((c) => (
                <Tr key={c.id} className="hover:bg-bg/70">
                  <Td>
                    <Link href={`/admin/clientes/${c.id}`} className="font-bold underline-offset-4 hover:underline">
                      {c.name}
                    </Link>
                  </Td>
                  <Td className="whitespace-nowrap tabular-nums">{formatPhone(c.phone)}</Td>
                  <Td className="text-muted">{c.email ?? "—"}</Td>
                  <Td>
                    <Badge tone={c.status === "active" ? "success" : "warning"}>{CUSTOMER_STATUS_LABELS[c.status]}</Badge>
                  </Td>
                  <Td className="whitespace-nowrap text-muted">{formatLimaDate(new Date(c.updatedAt))}</Td>
                </Tr>
              ))}
            </TBody>
          </Table>
          <nav aria-label="Paginación" className="flex items-center justify-between border-t border-line px-6 py-4 text-[13px] text-muted">
            <span>
              {data.total} cliente{data.total === 1 ? "" : "s"} · página {data.page} de {pages}
            </span>
            <div className="flex gap-2">
              {data.page > 1 ? (
                <Button variant="secondary" size="sm" disabled={pending} onClick={() => load({ ...query, page: data.page - 1 })}>
                  <ChevronLeft aria-hidden /> Anterior
                </Button>
              ) : null}
              {data.page < pages ? (
                <Button variant="secondary" size="sm" disabled={pending} onClick={() => load({ ...query, page: data.page + 1 })}>
                  Siguiente <ChevronRight aria-hidden />
                </Button>
              ) : null}
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}
