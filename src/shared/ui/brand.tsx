import Image from "next/image";

import { cn } from "./cn";

type LogoProps = {
  /** `ink` sobre fondos claros, `white` sobre fondos oscuros. */
  tone?: "ink" | "white";
  className?: string;
  /** Texto alternativo; vacío si el logo es decorativo dentro de un enlace con etiqueta. */
  alt?: string;
  preload?: boolean;
};

const logos = {
  ink: { src: "/brand/logo-tinta.png", width: 800, height: 236 },
  white: { src: "/brand/logo-blanco.png", width: 800, height: 238 },
} as const;

export function Logo({ tone = "ink", className, alt = "BLESH", preload }: LogoProps) {
  const logo = logos[tone];
  return (
    <Image
      src={logo.src}
      alt={alt}
      width={logo.width}
      height={logo.height}
      preload={preload}
      className={cn("h-7 w-auto shrink-0 self-start object-contain", className)}
    />
  );
}

/** Monograma «b» del kit de marca (aproximación tipográfica; ver kit). */
export function Monogram({ className, alt = "" }: { className?: string; alt?: string }) {
  return (
    <Image
      src="/brand/monograma.png"
      alt={alt}
      width={256}
      height={256}
      className={cn("size-9 rounded-[10px]", className)}
    />
  );
}
