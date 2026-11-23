"use client";

import { Toaster as Sonner } from "sonner";

/** Notificaciones con la estética de marca (píldora oscura). */
export function Toaster() {
  return (
    <Sonner
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: "!rounded-full !bg-ink !text-white !border-0 !px-5 !py-3 !text-[13px] !font-semibold !shadow-[0_12px_40px_rgba(0,0,0,0.25)]",
          icon: "!text-white",
        },
      }}
    />
  );
}
