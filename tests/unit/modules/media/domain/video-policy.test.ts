import { describe, expect, it } from "vitest";

import { videoProblem } from "@/modules/media/domain/video-policy";

function box(type: string, body: Uint8Array) {
  const bytes = new Uint8Array(8 + body.length);
  new DataView(bytes.buffer).setUint32(0, bytes.length);
  bytes.set(new TextEncoder().encode(type), 4); bytes.set(body, 8); return bytes;
}
describe("archivo MP4 de la biblioteca", () => {
  it("rechaza archivos renombrados, truncados y demasiado grandes", () => {
    expect(videoProblem(new TextEncoder().encode("<html>video.mp4</html>"))).not.toBeNull();
    expect(videoProblem(new Uint8Array(5 * 1024 * 1024 + 1))).toMatch(/5 MB/);
    const valid = new Uint8Array([...box("ftyp", new TextEncoder().encode("isom0000")), ...box("moov", new Uint8Array(4)), ...box("mdat", new Uint8Array(4))]);
    expect(videoProblem(valid)).toBeNull();
    expect(videoProblem(valid.subarray(0, valid.length - 1))).not.toBeNull();
  });
});
