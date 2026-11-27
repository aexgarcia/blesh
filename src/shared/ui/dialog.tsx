"use client";

import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";

import { cn } from "./cn";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

/** Diálogo modal accesible (foco atrapado, Escape, título obligatorio). */
export function DialogContent({ title, description, children, className }: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in" />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] max-w-md overflow-y-auto -translate-x-1/2 -translate-y-1/2 rounded-[20px] bg-bg p-6 shadow-[0_20px_60px_rgba(0,0,0,0.25)] focus:outline-none",
          className,
        )}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <DialogPrimitive.Title className="text-[17px] font-extrabold tracking-[-0.01em]">{title}</DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-1 text-[13px] text-muted">{description}</DialogPrimitive.Description>
            ) : (
              <DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close className="grid size-8 place-items-center rounded-full hover:bg-black/5" aria-label="Cerrar">
            <X className="size-4" aria-hidden />
          </DialogPrimitive.Close>
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

/**
 * Panel lateral modal (carrito, menú móvil): mismo foco atrapado y Escape que el diálogo.
 * `side="right"` en escritorio flota con margen, como el prototipo; en móvil ocupa casi todo.
 */
export function SheetContent({ title, description, children, className, side = "right", headerExtra }: {
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  side?: "right" | "left";
  headerExtra?: React.ReactNode;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]" />
      <DialogPrimitive.Content
        className={cn(
          "fixed bottom-2.5 top-2.5 z-50 flex w-[min(440px,calc(100%-20px))] flex-col overflow-hidden rounded-[20px] bg-bg shadow-[0_20px_60px_rgba(0,0,0,0.25)] focus:outline-none",
          side === "right" ? "right-2.5" : "left-2.5",
          className,
        )}
      >
        <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <DialogPrimitive.Title className="text-[15px] font-black uppercase tracking-[-0.01em]">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Description className={description ? "mt-0.5 text-[12px] text-muted" : "sr-only"}>{description ?? title}</DialogPrimitive.Description>
          </div>
          <div className="flex items-center gap-1">
            {headerExtra}
            <DialogPrimitive.Close className="grid size-9 place-items-center rounded-full hover:bg-black/5" aria-label="Cerrar">
              <X className="size-4" aria-hidden />
            </DialogPrimitive.Close>
          </div>
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
