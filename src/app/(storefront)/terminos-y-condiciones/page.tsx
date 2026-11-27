import type { Metadata } from "next";
import Link from "next/link";

import { REQUEST_TERMS } from "@/modules/sales/contracts";

export const metadata: Metadata = {
  title: "Términos y condiciones",
  description: "Condiciones para registrar una solicitud de compra en BLESH y coordinarla por WhatsApp.",
};

/** Mismo texto (y versión) que se acepta en el formulario de solicitud. */
export default function TermsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-14">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-muted">Legal</p>
      <h1 className="mt-2 text-[clamp(2rem,5vw,3rem)] font-black uppercase leading-none tracking-[-0.02em]">Términos y condiciones</h1>
      <p className="mt-3 text-[12.5px] text-muted">
        Versión {REQUEST_TERMS.version}
        {REQUEST_TERMS.status === "draft" ? " · en revisión: las políticas completas de entrega, cambios y privacidad se publicarán antes de vender." : ""}
      </p>
      <ol className="mt-8 list-decimal space-y-4 pl-5 text-[15px] leading-relaxed text-ink/85">
        {REQUEST_TERMS.points.map((point) => (
          <li key={point}>{point}</li>
        ))}
      </ol>
      <Link href="/productos" className="mt-10 inline-block text-[12px] font-extrabold uppercase tracking-[0.08em] underline underline-offset-4">Ver productos</Link>
    </main>
  );
}
