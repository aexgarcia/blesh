import { ChevronDown } from "lucide-react";
import { useId } from "react";

import { cn } from "./cn";

const controlBase =
  "w-full rounded-[12px] border border-line bg-surface px-3.5 text-[14px] text-ink transition-colors placeholder:text-muted/70 hover:border-muted/60 focus-visible:border-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/10 disabled:cursor-not-allowed disabled:bg-card/40 aria-invalid:border-sale aria-invalid:ring-sale/10";

export function Input({ className, ...props }: React.ComponentProps<"input">) {
  return <input className={cn(controlBase, "h-11", className)} {...props} />;
}

/** Select nativo (accesible en móvil) con el estilo de los campos. */
export function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative">
      <select className={cn(controlBase, "h-11 cursor-pointer appearance-none pr-10", className)} {...props} />
      <ChevronDown aria-hidden className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
    </div>
  );
}

export function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea className={cn(controlBase, "min-h-24 py-3", className)} {...props} />;
}

export function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label className={cn("text-[11px] font-extrabold uppercase tracking-[0.05em] text-ink", className)} {...props} />;
}

type FieldProps = {
  label: string;
  /** Mensaje de error de validación (servidor o cliente). */
  error?: string;
  hint?: string;
  className?: string;
  /** Recibe los atributos de accesibilidad para el control. */
  children: (control: { id: string; "aria-invalid"?: true; "aria-describedby"?: string }) => React.ReactNode;
};

/** Agrupa etiqueta, control, ayuda y error con los atributos ARIA enlazados. */
export function Field({ label, error, hint, className, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={id}>{label}</Label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy })}
      {hint && !error ? (
        <p id={hintId} className="text-[12px] text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-[12px] font-semibold text-sale">
          {error}
        </p>
      ) : null}
    </div>
  );
}
