import { cn } from "./cn";

/**
 * Marco de aplicación con barra lateral oscura (escritorio) y barra superior (móvil).
 * Sin negocio: la navegación y el pie se inyectan.
 */
export function SidebarShell({ brand, nav, footer, children, className }: {
  brand: React.ReactNode;
  nav: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-svh flex-1 flex-col bg-bg md:flex-row", className)}>
      <aside className="sticky top-0 z-30 flex flex-col bg-darker text-white md:h-svh md:w-64 md:shrink-0">
        <div className="flex h-16 items-center px-6 md:h-20">{brand}</div>
        <nav aria-label="Administración" className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-1 md:flex-col md:overflow-visible md:pb-0">
          {nav}
        </nav>
        {footer ? <div className="hidden border-t border-white/10 p-4 md:block">{footer}</div> : null}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        {footer ? <div className="flex items-center justify-end border-b border-line bg-surface px-5 py-2 md:hidden">{footer}</div> : null}
        <main id="contenido" className="flex-1 px-5 py-8 md:px-10 md:py-10">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
