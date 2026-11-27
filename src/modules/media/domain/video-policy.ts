/** Inspección del contenedor ISO BMFF; no transcodifica ni certifica todos los códecs. */
export function videoProblem(bytes: Uint8Array): string | null {
  if (bytes.byteLength > 5 * 1024 * 1024) return "El video supera 5 MB. Exporta un MP4 corto optimizado para web.";
  if (bytes.byteLength < 32) return "El archivo no es un MP4 válido.";
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const type = (offset: number) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
  let offset = 0;
  const boxes = new Set<string>();
  while (offset < bytes.byteLength) {
    if (offset + 8 > bytes.byteLength) return "El MP4 está incompleto.";
    const size = view.getUint32(offset);
    const name = type(offset + 4);
    if (size < 8 || offset + size > bytes.byteLength) return "El MP4 tiene una estructura no compatible. Exporta de nuevo el video.";
    if (offset === 0 && (name !== "ftyp" || size < 16 || !["isom", "iso2", "mp41", "mp42", "avc1", "M4V "].includes(type(offset + 8)))) return "Usa un MP4 estándar para web (H.264 recomendado).";
    boxes.add(name);
    offset += size;
  }
  return boxes.has("moov") && boxes.has("mdat") ? null : "El MP4 no contiene la información necesaria para reproducirse.";
}
