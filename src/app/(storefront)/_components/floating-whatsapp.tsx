import type { ContentLink } from "@/modules/content/contracts";

import { WhatsAppIcon } from "./social-icons";

export function FloatingWhatsapp({ contact }: { contact: ContentLink | null }) {
  if (!contact) return null;
  return <a href={contact.href} target="_blank" rel="noopener noreferrer" aria-label="Escríbenos por WhatsApp" title="Escríbenos por WhatsApp"
    className="group fixed bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))] right-5 z-30 flex size-14 items-center justify-center rounded-full bg-[#25d366] text-white shadow-[0_6px_24px_rgba(0,0,0,0.22)] transition-transform hover:scale-105 hover:bg-[#1ebe5d] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink motion-reduce:transform-none md:right-7">
    <WhatsAppIcon className="size-8" />
    <span className="pointer-events-none absolute right-full mr-3 hidden whitespace-nowrap rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-white group-hover:block group-focus-visible:block">¿Te ayudamos?</span>
  </a>;
}
