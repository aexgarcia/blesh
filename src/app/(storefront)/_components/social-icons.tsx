import type { ContentLink } from "@/modules/content/contracts";

/** Íconos de redes del prototipo (SVG propios: lucide no incluye marcas). */
type IconProps = { className?: string };

export function InstagramIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
    </svg>
  );
}

function TikTokIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M16.6 5.8A4.3 4.3 0 0 1 15.5 3h-3.1v12.4a2.6 2.6 0 1 1-2.6-2.6c.3 0 .5 0 .8.1V9.7a5.7 5.7 0 1 0 4.9 5.7V9.1a7.4 7.4 0 0 0 4.3 1.4V7.4a4.3 4.3 0 0 1-3.2-1.6Z" />
    </svg>
  );
}

export function WhatsAppIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.5-.3Z" />
    </svg>
  );
}

function MailIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

type Socials = { instagram: ContentLink | null; tiktok: ContentLink | null; whatsapp: ContentLink | null; email: ContentLink | null };

const ENTRIES = [
  ["instagram", "Instagram", InstagramIcon],
  ["tiktok", "TikTok", TikTokIcon],
  ["whatsapp", "WhatsApp", WhatsAppIcon],
  ["email", "Email", MailIcon],
] as const;

/** Redes publicadas (las no confirmadas llegan como null y no se muestran). */
export function SocialLinks({ socials, variant = "icons" }: { socials: Socials; variant?: "icons" | "text" }) {
  return (
    <>
      {ENTRIES.map(([key, label, Icon]) => {
        const link = socials[key];
        if (!link) return null;
        const external = link.href.startsWith("http");
        const props = external ? { target: "_blank", rel: "noopener noreferrer" } : {};
        return variant === "icons" ? (
          <a key={key} href={link.href} {...props} aria-label={label} className="grid size-[38px] place-items-center rounded-full border border-white/20 transition-colors hover:bg-white/10">
            <Icon className="size-4" />
          </a>
        ) : (
          <a key={key} href={link.href} {...props}>
            {label}
          </a>
        );
      })}
    </>
  );
}
