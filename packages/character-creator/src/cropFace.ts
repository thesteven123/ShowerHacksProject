import sharp from "sharp";

export type FaceCropResult = {
  buffer: Buffer;
  width: number;
  height: number;
};

/**
 * Square face crop. Uses image center with a slight upward bias (typical portrait framing).
 * Swap for face-detection later without changing the public API.
 */
export async function cropFace(input: Buffer, size = 256): Promise<FaceCropResult> {
  const image = sharp(input);
  const meta = await image.metadata();
  const w = meta.width ?? size;
  const h = meta.height ?? size;
  const side = Math.min(w, h);
  const left = Math.floor((w - side) / 2);
  const top = Math.floor((h - side) * 0.35);

  const buffer = await sharp(input)
    .extract({
      left: Math.max(0, Math.min(left, w - side)),
      top: Math.max(0, Math.min(top, h - side)),
      width: side,
      height: side,
    })
    .resize(size, size, { fit: "cover" })
    .png()
    .toBuffer();

  return { buffer, width: size, height: size };
}
