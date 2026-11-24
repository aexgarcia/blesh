import { cn } from "./cn";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-[12px] bg-card/80", className)} />;
}

/** Esqueleto de una tarjeta con filas, para secciones que cargan datos. */
export function CardSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="rounded-card border border-line bg-surface p-6" aria-busy="true" aria-label="Cargando">
      <Skeleton className="mb-6 h-5 w-40" />
      <div className="space-y-4">
        {Array.from({ length: rows }, (_, i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
    </div>
  );
}
