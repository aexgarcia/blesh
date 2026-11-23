/** Tipos públicos del módulo media. */

/** Imagen lista para mostrarse (validada y convertida por el servidor). */
export type MediaImage = {
  id: string;
  url: string;
  width: number;
  height: number;
};

export type MediaErrorCode = "FILE_TOO_LARGE" | "UNSUPPORTED_FORMAT" | "IMAGE_TOO_SMALL" | "IMAGE_TOO_LARGE" | "INVALID_IMAGE" | "STORAGE_ERROR";

export const MEDIA_LIMITS = {
  maxBytes: 5 * 1024 * 1024,
  minSide: 400,
  maxSide: 6000,
  acceptedTypes: ["image/jpeg", "image/png", "image/webp"] as const,
} as const;
