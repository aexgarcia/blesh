"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "./cn";

/**
 * Carrusel horizontal con flechas (prototipo `.rail`): 5 columnas en escritorio, 4 en
 * tablet y 2,3 en móvil, con desplazamiento por toque/scroll y botones accesibles.
 */
export function Rail({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  const trackRef = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const update = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    setEdges({ start: track.scrollLeft < 5, end: track.scrollLeft + track.clientWidth >= track.scrollWidth - 5 });
  }, []);

  useEffect(() => {
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [update]);

  const scroll = (direction: 1 | -1) => trackRef.current?.scrollBy({ left: direction * trackRef.current.clientWidth * 0.8, behavior: "smooth" });

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => scroll(-1)}
        aria-label={`${label}: anteriores`}
        disabled={edges.start}
        className="absolute -left-2.5 top-[38%] z-10 hidden size-[38px] place-items-center rounded-full bg-white/90 text-ink shadow-[0_4px_16px_rgba(0,0,0,0.12)] transition-opacity disabled:pointer-events-none disabled:opacity-0 md:grid"
      >
        <ArrowLeft className="size-[18px]" aria-hidden />
      </button>
      <ul
        ref={trackRef}
        onScroll={update}
        aria-label={label}
        className="grid snap-x snap-mandatory auto-cols-[calc((100%-20px)/2.3)] grid-flow-col gap-2.5 overflow-x-auto pb-1 [scrollbar-width:none] md:auto-cols-[calc((100%-36px)/4)] md:gap-3 xl:auto-cols-[calc((100%-48px)/5)] [&::-webkit-scrollbar]:hidden [&>li]:snap-start"
      >
        {children}
      </ul>
      <button
        type="button"
        onClick={() => scroll(1)}
        aria-label={`${label}: siguientes`}
        disabled={edges.end}
        className="absolute -right-2.5 top-[38%] z-10 hidden size-[38px] place-items-center rounded-full bg-white/90 text-ink shadow-[0_4px_16px_rgba(0,0,0,0.12)] transition-opacity disabled:pointer-events-none disabled:opacity-0 md:grid"
      >
        <ArrowRight className="size-[18px]" aria-hidden />
      </button>
    </div>
  );
}
