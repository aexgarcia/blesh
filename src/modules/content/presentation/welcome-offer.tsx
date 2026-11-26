"use client";

import { Check, Copy, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useEffect, useState } from "react";

import { welcomeCoupon } from "@/shared/coupon/welcome-coupon";

import type { StorefrontContent } from "../contracts";

const SHOW_DELAY_MS = 1500;

/** Ventana de bienvenida con cupón: aparece una vez por código y guarda el cupón para la solicitud. */
export function WelcomeOffer({ offer, contactHref }: { offer: NonNullable<StorefrontContent["welcomeOffer"]>; contactHref: string | null }) {
  const [open, setOpen] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (welcomeCoupon.seen(offer.code) || window.location.pathname.startsWith("/solicitud")) return;
    const timer = window.setTimeout(() => setOpen(true), SHOW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [offer.code]);

  function change(next: boolean) {
    setOpen(next);
    if (!next) welcomeCoupon.markSeen(offer.code);
  }

  function reveal() {
    welcomeCoupon.set(offer.code);
    welcomeCoupon.markSeen(offer.code);
    setRevealed(true);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(offer.code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch { /* Sin portapapeles: el código queda visible para copiarlo a mano. */ }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={change}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/55 backdrop-blur-[3px]" />
        <DialogPrimitive.Content className="fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-24px)] w-[calc(100%-24px)] max-w-[960px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[#111] text-white shadow-[0_30px_90px_rgba(0,0,0,0.5)] focus:outline-none">
          <DialogPrimitive.Close aria-label="Cerrar" className="absolute right-4 top-4 z-10 grid size-10 place-items-center rounded-full border border-white/25 bg-black/50 hover:bg-white/10">
            <X className="size-4" aria-hidden />
          </DialogPrimitive.Close>
          <div className="grid min-h-0 flex-1 overflow-y-auto md:grid-cols-[2fr_3fr]">
            {offer.imageUrl ? (
              <div className="relative hidden min-h-[420px] md:block">
                <Image src={offer.imageUrl} alt="" fill sizes="(min-width: 768px) 384px, 0px" className="object-cover" />
              </div>
            ) : null}
            <div className={offer.imageUrl ? "flex flex-col justify-center px-7 py-10 md:px-16" : "flex flex-col justify-center px-7 py-10 md:col-span-2 md:px-16"}>
              {!revealed ? (
                <>
                  {offer.eyebrow ? <p className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.18em] text-white/70">{offer.eyebrow}</p> : null}
                  <DialogPrimitive.Title className="text-[clamp(2rem,5vw,3.4rem)] font-black uppercase leading-[0.95] tracking-[-0.02em]">{offer.title}</DialogPrimitive.Title>
                  <DialogPrimitive.Description className="mt-4 max-w-md text-[15px] leading-relaxed text-white/75">{offer.text || offer.title}</DialogPrimitive.Description>
                  <button type="button" onClick={reveal} className="mt-7 min-h-14 w-full max-w-md rounded-full bg-white px-6 text-[13px] font-extrabold uppercase tracking-[0.12em] text-black hover:bg-white/90">
                    {offer.buttonLabel}
                  </button>
                  {offer.terms ? <p className="mt-5 max-w-md text-[11.5px] leading-relaxed text-white/50">{offer.terms}</p> : null}
                </>
              ) : (
                <>
                  <DialogPrimitive.Title className="flex items-center gap-2 text-[16px] font-bold"><Check className="size-4" aria-hidden /> ¡Listo! Guarda tu código</DialogPrimitive.Title>
                  <div className="mt-4 flex max-w-md overflow-hidden rounded-full border border-white/25">
                    <span className="flex-1 px-6 py-4 text-[18px] font-black tracking-[0.04em]">{offer.code}</span>
                    <button type="button" onClick={copy} aria-label="Copiar código" className="grid w-14 place-items-center border-l border-white/25 hover:bg-white/10">
                      {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
                    </button>
                  </div>
                  <DialogPrimitive.Description className="mt-3 max-w-md text-[12px] leading-relaxed text-white/60">
                    Lo incluimos automáticamente en tu solicitud por WhatsApp. {offer.terms}
                  </DialogPrimitive.Description>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-white/10 px-7 py-4 text-[11.5px] font-semibold uppercase tracking-[0.08em]">
            <Link href="/productos" onClick={() => change(false)} className="text-white/70 hover:text-white">Ver productos</Link>
            {contactHref ? <a href={contactHref} target="_blank" rel="noopener noreferrer" className="hover:underline">Contáctanos</a> : null}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
