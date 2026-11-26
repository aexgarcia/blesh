"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import Image from "next/image";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useRef, useState } from "react";

import { cn } from "@/shared/ui/cn";

export type GalleryImage = { url: string; width: number; height: number; alt: string };

/**
 * Galería de la ficha: rejilla 2 columnas en escritorio, carrusel con indicadores en móvil
 * y visor ampliado accesible (Escape, flechas del teclado, foco atrapado).
 */
export function ProductGallery({ images, title }: { images: GalleryImage[]; title: string }) {
  const [active, setActive] = useState(0);
  const [viewer, setViewer] = useState<number | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  if (images.length === 0) {
    return <div aria-hidden className="aspect-[4/5] rounded-card bg-card" />;
  }

  function onScroll() {
    const track = trackRef.current;
    const first = track?.firstElementChild as HTMLElement | null;
    if (!track || !first) return;
    setActive(Math.round(track.scrollLeft / (first.offsetWidth + 8)));
  }

  const step = (delta: number) => setViewer((i) => (i === null ? i : (i + delta + images.length) % images.length));

  return (
    <div>
      <div
        ref={trackRef}
        onScroll={onScroll}
        className={cn(
          "-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 [scrollbar-width:none] lg:mx-0 lg:grid lg:overflow-visible lg:px-0 [&::-webkit-scrollbar]:hidden",
          images.length > 1 ? "lg:grid-cols-2" : "lg:max-w-[640px] lg:grid-cols-1",
        )}
      >
        {images.map((image, i) => (
          <button
            key={image.url}
            type="button"
            onClick={() => setViewer(i)}
            className={cn(
              "relative aspect-[4/5] shrink-0 cursor-zoom-in snap-center overflow-hidden rounded-card bg-card lg:w-auto",
              images.length > 1 ? "w-[86%]" : "w-full",
            )}
            aria-label={`Ampliar imagen ${i + 1} de ${images.length}`}
          >
            <Image src={image.url} alt={image.alt || `${title}, imagen ${i + 1}`} fill sizes="(max-width: 1024px) 86vw, 30vw" preload={i === 0} className="object-cover" />
          </button>
        ))}
      </div>
      {images.length > 1 ? (
        <div aria-hidden className="mt-2.5 flex justify-center gap-1.5 lg:hidden">
          {images.map((image, i) => (
            <i key={image.url} className={cn("h-1.5 rounded-full bg-[#cfcbcc] transition-all", i === active ? "w-[18px] bg-ink" : "w-1.5")} />
          ))}
        </div>
      ) : null}

      <DialogPrimitive.Root open={viewer !== null} onOpenChange={(open) => !open && setViewer(null)}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[rgba(15,15,15,0.96)]" />
          <DialogPrimitive.Content
            className="fixed inset-0 z-50 flex items-center justify-center focus:outline-none"
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") step(-1);
              if (e.key === "ArrowRight") step(1);
            }}
          >
            <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Description className="sr-only">
              Imagen {(viewer ?? 0) + 1} de {images.length}. Usa las flechas para cambiar de imagen.
            </DialogPrimitive.Description>
            {viewer !== null ? (
              <div className="relative h-[90vh] w-[92vw]">
                <Image src={images[viewer].url} alt={images[viewer].alt || title} fill sizes="92vw" className="rounded-[10px] object-contain" />
              </div>
            ) : null}
            <DialogPrimitive.Close className="absolute right-4 top-4 grid size-11 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Cerrar">
              <X className="size-5" aria-hidden />
            </DialogPrimitive.Close>
            {images.length > 1 ? (
              <>
                <button type="button" onClick={() => step(-1)} className="absolute left-4 grid size-11 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Imagen anterior">
                  <ChevronLeft className="size-5" aria-hidden />
                </button>
                <button type="button" onClick={() => step(1)} className="absolute right-4 grid size-11 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Imagen siguiente">
                  <ChevronRight className="size-5" aria-hidden />
                </button>
              </>
            ) : null}
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  );
}
