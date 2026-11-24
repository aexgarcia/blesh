import { Logo, Monogram } from "@/shared/ui/brand";

/** Marco de las pantallas de acceso: panel de marca oscuro + tarjeta del formulario. */
export function AuthShell({ eyebrow, title, description, children, footer }: {
  eyebrow: string;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="grid min-h-svh flex-1 lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-darker p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-40 -top-40 size-[520px] rounded-full bg-violet/25 blur-[140px]"
        />
        <Logo tone="white" className="relative h-9" alt="BLESH" preload />
        <div className="relative">
          <p className="mb-4 text-[10px] font-extrabold uppercase tracking-[0.12em] text-white/50">Administración</p>
          <p className="max-w-md text-[clamp(28px,3vw,44px)] font-black uppercase leading-[0.95] tracking-[-0.035em]">
            Productos, pedidos y clientes en un solo lugar.
          </p>
        </div>
        <p className="relative text-[11px] text-white/40">Acceso exclusivo para el equipo BLESH · Hecho en Perú</p>
      </section>

      <section className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-[400px]">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <Monogram />
            <Logo className="h-6" />
          </div>
          <p className="eyebrow mb-2">{eyebrow}</p>
          <h1 className="text-[28px] font-black uppercase leading-none tracking-[-0.035em]">{title}</h1>
          {description ? <div className="mt-3 text-[13px] text-muted">{description}</div> : null}
          <div className="mt-8">{children}</div>
          {footer ? <div className="mt-8 border-t border-line pt-6 text-[13px] text-muted">{footer}</div> : null}
        </div>
      </section>
    </main>
  );
}
