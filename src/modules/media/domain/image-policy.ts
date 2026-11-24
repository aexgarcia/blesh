import { MEDIA_LIMITS, type MediaErrorCode } from "../contracts";

/** Formatos detectados por contenido (no por extensión ni Content-Type declarado). */
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp"]);

export type InspectedImage = { format: string; width: number; height: number; pages?: number };

export type PolicyViolation = { code: MediaErrorCode; message: string };

export function checkByteSize(bytes: number): PolicyViolation | null {
  if (bytes <= 0) return { code: "INVALID_IMAGE", message: "El archivo está vacío." };
  if (bytes > MEDIA_LIMITS.maxBytes) return { code: "FILE_TOO_LARGE", message: "La imagen supera 5 MB." };
  return null;
}

/** Valida el contenido real: rechaza SVG/HTML, animaciones y tamaños fuera de rango. */
export function checkImage(image: InspectedImage): PolicyViolation | null {
  if (!ALLOWED_FORMATS.has(image.format)) {
    return { code: "UNSUPPORTED_FORMAT", message: "Formato no admitido. Usa JPEG, PNG o WebP." };
  }
  if ((image.pages ?? 1) > 1) return { code: "UNSUPPORTED_FORMAT", message: "No se admiten imágenes animadas." };
  const shortest = Math.min(image.width, image.height);
  const longest = Math.max(image.width, image.height);
  if (shortest < MEDIA_LIMITS.minSide) {
    return { code: "IMAGE_TOO_SMALL", message: `La imagen debe medir al menos ${MEDIA_LIMITS.minSide} px por lado.` };
  }
  if (longest > MEDIA_LIMITS.maxSide) {
    return { code: "IMAGE_TOO_LARGE", message: `La imagen no puede superar ${MEDIA_LIMITS.maxSide} px por lado.` };
  }
  return null;
}
