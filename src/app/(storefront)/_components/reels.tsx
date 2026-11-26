"use client";

import { Play } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { formatPEN } from "@/shared/domain/money";
import { cn } from "@/shared/ui/cn";

export type ReelItem = { title: string; href: string | null; priceMinor: number | null; videoUrl: string | null; posterUrl: string | null };

/**
 * «En movimiento» (prototipo): videos silenciados que se reproducen al entrar en pantalla y
 * se pausan al salir; botón accesible para reproducir/pausar. Sin autoplay con
 * `prefers-reduced-motion`. Los videos viven en el almacenamiento propio (bucket `content`).
 */
export function Reels({ items, handle }: { items: ReelItem[]; handle: string }) {
  return (
    <div className="grid auto-cols-[72%] grid-flow-col gap-3 overflow-x-auto [scrollbar-width:none] max-md:snap-x max-md:snap-mandatory md:grid-flow-row md:grid-cols-3 [&::-webkit-scrollbar]:hidden">
      {items.map((item) => (
        <Reel key={item.title} item={item} handle={handle} />
      ))}
    </div>
  );
}

function Reel({ item, handle }: { item: ReelItem; handle: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || typeof IntersectionObserver === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) video.play().then(() => setPlaying(true), () => undefined);
        else {
          video.pause();
          setPlaying(false);
        }
      },
      { threshold: 0.6 },
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  function toggle() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().then(() => setPlaying(true), () => undefined);
    else {
      video.pause();
      setPlaying(false);
    }
  }

  return (
    <div className="relative aspect-[9/14] snap-start overflow-hidden rounded-card bg-[#2a2a2a] after:pointer-events-none after:absolute after:inset-0 after:bg-[linear-gradient(180deg,rgba(0,0,0,0.3),transparent_25%,transparent_70%,rgba(0,0,0,0.35))]">
      {item.videoUrl ? (
        <video ref={videoRef} src={item.videoUrl} poster={item.posterUrl ?? undefined} muted loop playsInline preload="none" className="absolute inset-0 size-full object-cover" aria-label={item.title} />
      ) : item.posterUrl ? (
        <Image src={item.posterUrl} alt="" fill sizes="33vw" className="object-cover" />
      ) : null}
      <div className="absolute left-3.5 top-3.5 z-[2] flex items-center gap-1.5 text-[11px] font-extrabold text-white">
        <i className="grid size-5 place-items-center overflow-hidden rounded-full bg-white p-[3px]">
          <Image src="/brand/monograma.png" alt="" width={20} height={20} className="object-contain" />
        </i>
        {handle}
      </div>
      {item.videoUrl ? (
        <button type="button" onClick={toggle} aria-label={`${playing ? "Pausar" : "Reproducir"} ${item.title}`} aria-pressed={playing} className="absolute inset-0 z-[3] grid place-items-center">
          <span className={cn("grid size-14 place-items-center rounded-full bg-white/25 backdrop-blur-[10px] transition-[opacity,transform]", playing && "scale-[0.8] opacity-0")}>
            <Play className="size-[22px] fill-white text-white" aria-hidden />
          </span>
        </button>
      ) : null}
      {item.href ? (
        <Link
          href={item.href}
          className="absolute inset-x-2.5 bottom-2.5 z-[4] flex items-center justify-between gap-2 rounded-[12px] bg-white/15 px-3 py-2.5 text-[11px] font-extrabold uppercase tracking-[0.02em] text-white backdrop-blur-[14px]"
        >
          <span>{item.title}</span>
          <span className="tabular-nums">{item.priceMinor !== null ? `${formatPEN(item.priceMinor)} ↗` : "↗"}</span>
        </Link>
      ) : null}
    </div>
  );
}
