import Image from "next/image";

import { Card } from "@/shared/ui/surface";

export function StorefrontLibrary({ assets, assetBase }: { assets: { key: string; kind: "video" | "image" }[]; assetBase: string }) {
  return <Card className="p-5 md:p-7"><h2 className="text-xl font-black">Archivos disponibles <span className="text-muted">({assets.length})</span></h2>
    <p className="mt-2 text-sm text-muted">Selecciona estos archivos desde Portada, Colecciones o En movimiento. Si subes un archivo en otra pestaña, recarga el editor para verlo en su selector.</p>
    <ul className="mt-5 grid gap-3 sm:grid-cols-2">{assets.map((asset) => <li key={asset.key} className="flex min-w-0 items-center gap-3 rounded-xl border border-line p-3">
      <div className="relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-card">{asset.kind === "image" ? <Image src={`${assetBase}${asset.key}`} alt="" fill sizes="56px" className="object-cover" /> : <span className="text-[10px] font-black">MP4</span>}</div>
      <div className="min-w-0"><p className="break-all text-xs font-semibold">{asset.key}</p><a href={`${assetBase}${asset.key}`} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-xs text-muted underline" aria-label={`Abrir archivo ${asset.key}`}>Abrir archivo ↗</a></div>
    </li>)}</ul>
    {!assets.length ? <p className="mt-5 text-sm text-muted">Todavía no hay archivos. Sube el primero desde el formulario superior.</p> : null}
  </Card>;
}
