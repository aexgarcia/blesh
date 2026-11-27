"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import type { AnalyticsEvent } from "./events";
import { trackEvent } from "./track";

/** Visibilidad real, no prerender/prefetch. No se reproducen impresiones previas al permiso. */
export function AnalyticsImpression({ event }: { event: AnalyticsEvent }) {
  const ref = useRef<HTMLSpanElement>(null);
  const sent = useRef(false);
  useEffect(() => {
    if (!ref.current || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || sent.current) return;
      sent.current = true;
      trackEvent(event);
      observer.disconnect();
    });
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [event]);
  return <span ref={ref} aria-hidden className="pointer-events-none block h-px w-px" />;
}

export function AnalyticsLink({ event, ...props }: React.ComponentProps<typeof Link> & { event: AnalyticsEvent }) {
  return <Link {...props} onClick={(e) => { props.onClick?.(e); if (!e.defaultPrevented) trackEvent(event); }} />;
}
