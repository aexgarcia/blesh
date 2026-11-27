import Image from "next/image";
import Link from "next/link";

import { cn } from "@/shared/ui/cn";

export type ColorOption = {
  slug: string;
  label: string;
  swatchHex: string | null;
  href: string;
  current: boolean;
  image: { url: string } | null;
};

/**
 * Pastillas de color (prototipo `.color-pill`): cada color tiene su URL y canonical. Con un
 * solo color, la ficha puede pasar los diseños hermanos de la categoría con `label="Modelo"`.
 */
export function ColorOptions({ colors, label = "Color" }: { colors: ColorOption[]; label?: string }) {
  if (colors.length < 2) return null;
  return (
    <nav aria-label={label} className="grid grid-cols-[64px_1fr] items-center gap-3">
      <span className="text-[10.5px] font-extrabold uppercase tracking-[0.05em]">{label}</span>
      <ul className="flex flex-wrap gap-1.5">
        {colors.map((c) => (
          <li key={c.href}>
            <Link
              href={c.href}
              aria-current={c.current ? "page" : undefined}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-full border border-line bg-surface pl-2 pr-4 text-[11px] font-extrabold uppercase tracking-[0.03em] transition-colors hover:border-ink",
                c.current && "border-ink bg-ink text-white",
              )}
            >
              <span aria-hidden className="relative size-[22px] overflow-hidden rounded-full border border-black/10" style={c.swatchHex ? { background: c.swatchHex } : undefined}>
                {!c.swatchHex && c.image ? <Image src={c.image.url} alt="" fill sizes="22px" className="object-cover" /> : null}
              </span>
              {c.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

import type { SizeGuideData } from "../../contracts";
export type { SizeGuideData } from "../../contracts";

/** Tabla de medidas (centímetros) de la guía asignada al producto. */
export function SizeGuideTable({ guide, selectedSize }: { guide: SizeGuideData; selectedSize?: string }) {
  return (
    <table className="w-full border-collapse text-[13px]">
      <caption className="sr-only">Guía de tallas {guide.name}, en centímetros</caption>
      <thead>
        <tr className="text-[10px] font-extrabold uppercase tracking-[0.05em] text-muted">
          <th scope="col" className="border-b border-line p-3 text-center">Talla</th>
          <th scope="col" className="border-b border-line p-3 text-center">Largo (cm)</th>
          <th scope="col" className="border-b border-line p-3 text-center">Ancho (cm)</th>
        </tr>
      </thead>
      <tbody>
        {guide.rows.map((r) => (
          <tr key={r.sizeCode} aria-current={selectedSize === r.sizeCode ? "true" : undefined} className={selectedSize === r.sizeCode ? "bg-ink text-white" : undefined}>
            <th scope="row" className="border-b border-line p-3 text-center font-black">
              {r.sizeCode === "UNICA" ? "Única" : r.sizeCode}
            </th>
            <td className="border-b border-line p-3 text-center tabular-nums">{r.lengthCm}</td>
            <td className="border-b border-line p-3 text-center tabular-nums">{r.widthCm}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
