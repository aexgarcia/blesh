import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { cacheLife } from "next/cache";
import Link from "next/link";

import type { StorefrontContent } from "@/modules/content/contracts";

import { SocialLinks } from "./social-icons";

/**
 * Pie del prototipo: logo grande y tarjeta de 4 columnas. El newsletter queda visible pero
 * desactivado («Próximamente»). Contactos configurados en Tienda; políticas pendientes aparte.
 */
export async function SiteFooter({ content }: { content: StorefrontContent }) {
  const { footer, socials } = content;
  const year = await copyrightYear();
  return (
    <footer id="contacto" className="bg-darker pb-[26px] pt-[72px] text-white">
      <div className="mx-auto max-w-site px-5 max-md:px-4">
        <Image src="/brand/logo-blanco.png" alt="BLESH" width={800} height={238} className="mx-auto mb-14 h-[clamp(70px,14vw,190px)] w-auto opacity-95" />
        <div className="grid gap-8 rounded-[22px] border border-white/12 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-6 sm:grid-cols-2 md:p-8 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <h2 className="mb-3.5 text-[11px] font-black uppercase tracking-[0.05em]">{footer.community.title}</h2>
            <p className="text-[12.5px] text-white/65">{footer.community.text}</p>
            <form aria-label="Newsletter" className="mt-1 flex h-[46px] items-center rounded-full border border-white/25 pl-[18px] pr-1.5 opacity-70">
              <input
                type="email"
                disabled={!footer.community.enabled}
                placeholder={footer.community.enabled ? "Tu email" : "Próximamente"}
                aria-label="Email (próximamente)"
                className="min-w-0 flex-1 bg-transparent text-[12.5px] text-white outline-none placeholder:text-white/45 disabled:cursor-not-allowed"
              />
              <button type="submit" disabled aria-label="Suscribirme (próximamente)" className="grid size-9 place-items-center rounded-full disabled:cursor-not-allowed">
                <ArrowRight className="size-[18px]" aria-hidden />
              </button>
            </form>
            {!footer.community.enabled ? <p className="mt-2 text-[11px] text-white/45">Las suscripciones abrirán pronto. Aún no guardamos correos.</p> : null}
            <div className="mt-[22px] flex gap-2">
              <SocialLinks socials={socials} />
            </div>
          </div>
          <FooterColumn title="Tienda">
            {footer.shopLinks.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="text-[12.5px] text-white/65 transition-colors hover:text-white">
                  {l.label}
                </Link>
              </li>
            ))}
          </FooterColumn>
          <FooterColumn title="Contáctanos">
            {footer.contactLinks.map((l) => (
              <li key={l.href}>
                <a href={l.href} {...(l.external ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="text-[12.5px] text-white/65 transition-colors hover:text-white">
                  {l.label}
                </a>
              </li>
            ))}
          </FooterColumn>
          <FooterColumn title="Políticas">
            {footer.policiesPending ? (
              <li className="text-[12.5px] text-white/65">En preparación. Pagos y entregas se acuerdan contigo por WhatsApp antes de confirmar.</li>
            ) : (
              footer.policyLinks.map((l) => (
                <li key={l.href}>
                  <a href={l.href} target="_blank" rel="noopener noreferrer" className="text-[12.5px] text-white/65 transition-colors hover:text-white">
                    {l.label}
                  </a>
                </li>
              ))
            )}
          </FooterColumn>
        </div>
        {content.business.legalName || content.business.taxId || content.business.address || content.business.openingHours ? <div className="mt-6 space-y-1 break-words text-xs text-white/65" aria-label="Datos del negocio">
          {content.business.legalName ? <p>{content.business.legalName}</p> : null}
          {content.business.taxId ? <p>RUC: {content.business.taxId}</p> : null}
          {content.business.address ? <p>{content.business.address}</p> : null}
          {content.business.openingHours ? <p>Atención: {content.business.openingHours}</p> : null}
        </div> : null}
        <div className="mt-[26px] flex flex-wrap justify-between gap-4 border-t border-white/10 pt-[22px] text-[11px] text-white/50">
          <span>
            © {year} {footer.copyright}
          </span>
          <span>{footer.location}</span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-3.5 text-[11px] font-black uppercase tracking-[0.05em]">{title}</h2>
      <ul className="space-y-2">{children}</ul>
    </div>
  );
}

/** Año del pie: con Cache Components la hora se lee dentro de una caché (se renueva a diario). */
async function copyrightYear() {
  "use cache";
  cacheLife("days");
  return new Date().getFullYear();
}
