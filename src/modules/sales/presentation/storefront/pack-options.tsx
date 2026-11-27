"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Children, useEffect, useRef, useState } from "react";

type Props = { label: string; carousel: boolean; children: React.ReactNode };

export function PackOptions({ carousel, ...props }: Props) {
  if (carousel) return <OptionCarousel {...props} />;
  return <div className="flex min-w-0 flex-wrap items-start gap-2" role="radiogroup" aria-label={props.label}>{props.children}</div>;
}

/** Desplazamiento exclusivamente manual: botones, gesto táctil y teclado. */
function OptionCarousel({ label, children }: Omit<Props, "carousel">) {
  const track = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });
  const count = Children.count(children);

  function measure() {
    const el = track.current;
    if (!el) return;
    const next = { start: el.scrollLeft <= 2, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 };
    setEdges((previous) => previous.start === next.start && previous.end === next.end ? previous : next);
  }

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [count]);

  function scroll(direction: -1 | 1) {
    const el = track.current;
    if (!el) return;
    el.scrollBy({ left: direction * Math.max(104, el.clientWidth - 104), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }

  return <div className="grid min-w-0 grid-cols-[28px_minmax(0,1fr)_28px] items-center gap-1">
    <button type="button" aria-label={`${label}: anteriores`} disabled={edges.start} onClick={() => scroll(-1)} className="grid size-7 place-items-center rounded-full border border-line bg-surface transition-colors hover:border-ink disabled:opacity-25">
      <ChevronLeft className="size-4" aria-hidden />
    </button>
    <div
      ref={track}
      role="radiogroup"
      aria-label={label}
      onScroll={measure}
      onKeyDown={(event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
        const options = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button[role="radio"]'));
        const index = options.indexOf(event.target as HTMLButtonElement);
        if (index < 0) return;
        event.preventDefault();
        const next = event.key === "Home" ? 0 : event.key === "End" ? options.length - 1 : Math.max(0, Math.min(options.length - 1, index + (event.key === "ArrowRight" ? 1 : -1)));
        options[next].focus({ preventScroll: true });
        options[next].scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
        if (options[next].getAttribute("aria-checked") !== "true") options[next].click();
      }}
      className="flex min-w-0 snap-x snap-proximity items-start gap-2 overflow-x-auto overscroll-x-contain p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>button]:snap-start"
    >{children}</div>
    <button type="button" aria-label={`${label}: siguientes`} disabled={edges.end} onClick={() => scroll(1)} className="grid size-7 place-items-center rounded-full border border-line bg-surface transition-colors hover:border-ink disabled:opacity-25">
      <ChevronRight className="size-4" aria-hidden />
    </button>
  </div>;
}
