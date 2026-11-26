"use client";

import { useId, useState, useSyncExternalStore } from "react";

import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/ui/cn";

import type { ProductSizeGuide, SizeGuideData } from "../../contracts";
import {
  BODY_SIZE_RULES,
  recommendByBody,
} from "../../domain/size-recommendation";

const PREFERENCE_CHANGED = "blesh:size-preference-changed";
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(PREFERENCE_CHANGED, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(PREFERENCE_CHANGED, callback);
  };
}

function rememberedSize(
  value: string | null,
  signature: string,
  guide: SizeGuideData,
): string | null {
  try {
    const data = JSON.parse(value ?? "null");
    return data?.version === 1 &&
      data.guide === signature &&
      guide.rows.some((r) => r.sizeCode === data.sizeCode)
      ? data.sizeCode
      : null;
  } catch {
    return null;
  }
}

const sizeName = (code: string) => (code === "UNICA" ? "Única" : code);
const meters = (cm: number) => (cm / 100).toFixed(2);
const cmText = (value: string) =>
  `${Number(value.replace(",", ".")).toLocaleString("es-PE", { maximumFractionDigits: 1 })} cm`;

/** Rango de altura orientativo por talla, derivado de las mismas reglas del cálculo. */
const HEIGHT_HINT: Record<string, string> = {
  S: `hasta ${meters(BODY_SIZE_RULES.mFromHeightCm - 1)}`,
  M: `${meters(BODY_SIZE_RULES.mFromHeightCm)} a ${meters(BODY_SIZE_RULES.lFromHeightCm - 1)}`,
  L: `${meters(BODY_SIZE_RULES.lFromHeightCm)} a más`,
};

const FITS = [
  {
    value: "closer",
    label: "Más pegada",
    shift: -1,
    note: "Más cerca del cuerpo.",
  },
  {
    value: "recommended",
    label: "Recomendada",
    shift: 0,
    note: "El calce boxy como lo diseñamos.",
  },
  {
    value: "oversize",
    label: "Oversize",
    shift: 1,
    note: "Más amplia y relajada.",
  },
] as const;
type Fit = (typeof FITS)[number]["value"];

/** Talla por altura y peso, con preferencia de calce y la tabla de la prenda como referencia. */
export function SizeCalculator({
  product,
  onUse,
  whatsappHref,
}: {
  product: ProductSizeGuide & { guide: SizeGuideData };
  onUse: (sizeCode: string) => void;
  whatsappHref?: string | null;
}) {
  const id = useId();
  const [heightCm, setHeightCm] = useState(170);
  const [weightKg, setWeightKg] = useState(70);
  const [fit, setFit] = useState<Fit>("recommended");
  const [remember, setRemember] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const key = `blesh.size.${encodeURIComponent(product.productSlug || product.guide.name)}`;
  const signature = JSON.stringify(product.guide);
  const saved = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    () => null,
  );
  const savedSize = rememberedSize(saved, signature, product.guide);

  const sizes = product.guide.rows.map((r) => r.sizeCode);
  const base = recommendByBody({ heightCm, weightKg });
  const baseIndex = base ? sizes.indexOf(base) : -1;
  const chosenFit = FITS.find((f) => f.value === fit)!;
  const targetIndex = baseIndex + chosenFit.shift;
  const index =
    baseIndex < 0 ? -1 : Math.max(0, Math.min(sizes.length - 1, targetIndex));
  const sizeCode = index >= 0 ? sizes[index] : null;
  const atEdge = baseIndex >= 0 && targetIndex !== index;
  const available =
    sizeCode !== null && product.availableSizes.includes(sizeCode);

  function apply(code: string) {
    if (remember) {
      try {
        // Solo talla y versión de guía: nunca la altura ni el peso de la persona.
        window.localStorage.setItem(
          key,
          JSON.stringify({ version: 1, guide: signature, sizeCode: code }),
        );
        window.dispatchEvent(new Event(PREFERENCE_CHANGED));
      } catch {
        setStorageError(
          "Tu navegador no permite recordar la talla. Desmarca la opción para usarla solo en esta visita.",
        );
        return;
      }
    }
    onUse(code);
  }

  const sliders = [
    {
      id: `${id}-height`,
      label: "Altura",
      value: heightCm,
      min: 140,
      max: 210,
      display: `${meters(heightCm)} m`,
      set: setHeightCm,
      text: `${meters(heightCm)} metros`,
    },
    {
      id: `${id}-weight`,
      label: "Peso",
      value: weightKg,
      min: 40,
      max: 140,
      display: `${weightKg} kg`,
      set: setWeightKg,
      text: `${weightKg} kilos`,
    },
  ];

  return (
    <div className="space-y-5">
      {savedSize ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-ink px-3 py-3 text-[12px] font-extrabold uppercase tracking-[0.06em]">
          <button
            type="button"
            onClick={() => apply(savedSize)}
            disabled={!product.availableSizes.includes(savedSize)}
            className="hover:underline disabled:opacity-50"
          >
            Tu talla: {sizeName(savedSize)}
          </button>
          <span aria-hidden>·</span>
          <button
            type="button"
            className="underline"
            onClick={() => {
              try {
                window.localStorage.removeItem(key);
                window.dispatchEvent(new Event(PREFERENCE_CHANGED));
              } catch {
                setStorageError(
                  "No pudimos borrar la preferencia. Revisa el almacenamiento del navegador.",
                );
              }
            }}
          >
            Cambiar
          </button>
        </div>
      ) : null}

      {sliders.map((s) => (
        <div key={s.id} className="space-y-2">
          <div className="flex items-center justify-between">
            <label htmlFor={s.id} className="text-sm font-bold">
              {s.label}
            </label>
            <span className="text-sm font-bold tabular-nums">{s.display}</span>
          </div>
          <input
            id={s.id}
            type="range"
            min={s.min}
            max={s.max}
            step={1}
            value={s.value}
            aria-valuetext={s.text}
            onChange={(e) => s.set(Number(e.target.value))}
            className="h-6 w-full cursor-pointer accent-ink"
          />
        </div>
      ))}

      <div
        role="radiogroup"
        aria-label="Cómo te gusta que quede"
        className="grid grid-cols-3 gap-2"
      >
        {FITS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={fit === option.value}
            onClick={() => setFit(option.value)}
            className={cn(
              "min-h-10 rounded-full border border-ink px-2 text-[12px] font-bold",
              fit === option.value && "bg-ink text-white",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div aria-live="polite" className="space-y-1 text-center">
        {sizeCode ? (
          <>
            <p className="text-[12px] text-muted">Tu talla Blesh</p>
            <p className="text-5xl font-black">{sizeName(sizeCode)}</p>
            <p className="text-[12px] text-muted">
              {chosenFit.note}
              {atEdge
                ? ` Es la talla ${chosenFit.shift > 0 ? "más grande" : "más pequeña"} disponible.`
                : ""}
            </p>
            {!available ? (
              <p className="text-xs font-semibold text-sale">
                Esta talla no está disponible para la selección actual.
              </p>
            ) : null}
          </>
        ) : (
          <>
            <p className="text-sm">
              Esta prenda no tiene tu talla en su tabla. Escríbenos por WhatsApp
              y te ayudamos.
            </p>
            {whatsappHref ? (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-xs font-bold underline"
              >
                Abrir WhatsApp
              </a>
            ) : null}
          </>
        )}
      </div>

      <table className="w-full text-center text-[12.5px]">
        <caption className="sr-only">
          Medidas de {product.productTitle} con la prenda extendida
        </caption>
        <thead>
          <tr className="border-b border-line text-[12px] font-bold">
            <th className="py-2">Talla</th>
            <th>Largo</th>
            <th>Ancho</th>
            <th>Altura aprox.</th>
          </tr>
        </thead>
        <tbody>
          {product.guide.rows.map((row) => (
            <tr
              key={row.sizeCode}
              aria-current={row.sizeCode === sizeCode ? "true" : undefined}
              className={cn(
                "border-b border-line last:border-0",
                row.sizeCode === sizeCode && "bg-ink font-bold text-white",
              )}
            >
              <td className="py-2.5">{sizeName(row.sizeCode)}</td>
              <td>{cmText(row.lengthCm)}</td>
              <td>{cmText(row.widthCm)}</td>
              <td>{HEIGHT_HINT[row.sizeCode] ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <label className="flex items-center justify-center gap-2 text-[12.5px]">
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
          className="size-4 accent-ink"
        />
        <span>Recordar mi talla</span>
      </label>
      {storageError ? (
        <p role="alert" className="text-xs text-sale">
          {storageError}
        </p>
      ) : null}
      <Button
        block
        size="lg"
        disabled={!sizeCode || !available}
        onClick={() => sizeCode && apply(sizeCode)}
        className="uppercase tracking-[0.06em]"
      >
        {sizeCode ? `Usar talla ${sizeName(sizeCode)}` : "Sin talla sugerida"}
      </Button>
      <p className="text-center text-[10px] text-muted">
        Tu altura y peso no se guardan ni se envían a Analytics.
      </p>
    </div>
  );
}
