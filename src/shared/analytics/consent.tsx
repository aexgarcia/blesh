"use client";

import Script from "next/script";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

import { analyticsPage, clearAnalyticsCookies, createGa4Client } from "./ga4";
import { getConsent, saveConsent, serverConsent, subscribeConsent } from "./consent-store";

/** Sin ID/configuración, no banner, etiqueta, cookies ni solicitudes a Google. */
export function AnalyticsConsent({ measurementId, origin }: { measurementId: string | null; origin: string }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const consent = useSyncExternalStore(subscribeConsent, getConsent, serverConsent);
  const [settings, setSettings] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const client = useRef<ReturnType<typeof createGa4Client> | null>(null);
  const wasGranted = useRef(false);
  const href = `${origin}${pathname}?pagina=${params.get("pagina") ?? ""}`;
  const eligible = analyticsPage(href, origin) !== null;

  useEffect(() => {
    if (!measurementId) return;
    if (!client.current) client.current = createGa4Client(measurementId, origin);
    const current = client.current;
    const page = analyticsPage(window.location.href, origin, document.referrer);
    if (consent === "granted" && page) {
      wasGranted.current = true;
      current.activate(page);
    } else {
      current.pause();
      if (wasGranted.current && consent !== "granted") {
        clearAnalyticsCookies();
        // Destruye listeners/timers de una etiqueta previamente cargada. Carrito se conserva.
        window.location.reload();
      }
    }
    const onHide = () => current.pause();
    window.addEventListener("pagehide", onHide);
    return () => { window.removeEventListener("pagehide", onHide); current.pause(); };
  }, [measurementId, origin, consent, href]);

  function choose(value: "granted" | "denied") {
    if (value === "denied") { client.current?.pause(); clearAnalyticsCookies(); }
    const saved = saveConsent(value);
    setStorageError(!saved);
    if (saved) setSettings(false);
  }

  if (!measurementId || !eligible) return null;
  return (
    <>
      {consent === "granted" ? <Script id="blesh-ga4" src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`} strategy="afterInteractive" /> : null}
      <button type="button" onClick={() => setSettings(true)} className="fixed bottom-3 left-3 z-30 rounded-full border border-line bg-surface px-3 py-2 text-xs font-bold shadow-sm">Preferencias de analítica</button>
      {consent === "unset" || settings || storageError ? (
        <section aria-label="Preferencias de analítica" className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-2xl rounded-card border border-line bg-surface p-5 shadow-xl">
          <h2 className="text-sm font-black">Analítica opcional</h2>
          <p className="mt-2 text-sm text-muted">Con tu permiso, Google Analytics nos ayuda a entender el uso de la tienda. No enviamos tus datos de contacto ni el mensaje de WhatsApp. Puedes comprar sin aceptar y cambiar tu decisión aquí.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" onClick={() => choose("granted")} className="rounded-full border border-ink px-5 py-2 text-sm font-bold">Aceptar analítica</button>
            <button type="button" onClick={() => choose("denied")} className="rounded-full border border-ink px-5 py-2 text-sm font-bold">Rechazar analítica</button>
            {settings && consent !== "unset" ? <button type="button" onClick={() => setSettings(false)} className="rounded-full px-3 py-2 text-sm underline">Cerrar</button> : null}
          </div>
          {storageError ? <p role="status" className="mt-2 text-sm">No pudimos guardar la preferencia. La analítica permanece desactivada.</p> : null}
        </section>
      ) : null}
    </>
  );
}
