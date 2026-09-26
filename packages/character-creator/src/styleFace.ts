import sharp from "sharp";
import type { CharacterVibe } from "@tiny-menaces/shared";

const VIBE_TINT: Record<CharacterVibe, { r: number; g: number; b: number }> = {
  chaotic: { r: 255, g: 120, b: 180 },
  dramatic: { r: 140, g: 100, b: 255 },
  supportive: { r: 100, g: 220, b: 160 },
};

/** Oval face silhouette (portrait framing), not a square photo frame. */
function faceOvalGeometry(size: number) {
  const cx = size / 2;
  const cy = size * 0.48;
  const rx = size * 0.36;
  const ry = size * 0.42;
  return { cx, cy, rx, ry };
}

function faceMaskSvg(size: number): string {
  const { cx, cy, rx, ry } = faceOvalGeometry(size);
  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="white"/>
  </svg>`;
}

function faceOutlineSvg(size: number): string {
  const { cx, cy, rx, ry } = faceOvalGeometry(size);
  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="#14141c" stroke-width="2.5"/>
    <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="white" stroke-width="1" opacity="0.4"/>
  </svg>`;
}

/** Applies vibe tint, oval alpha cutout, and a soft outline — no square photo frame. */
export async function styleFace(
  facePng: Buffer,
  vibe: CharacterVibe,
  outSize = 64,
): Promise<Buffer> {
  const tint = VIBE_TINT[vibe];
  const resized = await sharp(facePng).resize(outSize, outSize, { fit: "cover" }).png().toBuffer();

  const tinted = await sharp(resized)
    .composite([
      {
        input: Buffer.from([tint.r, tint.g, tint.b, 40]),
        raw: { width: 1, height: 1, channels: 4 },
        tile: true,
        blend: "over",
      },
    ])
    .png()
    .toBuffer();

  const mask = await sharp(Buffer.from(faceMaskSvg(outSize))).ensureAlpha().png().toBuffer();
  const cutout = await sharp(tinted)
    .ensureAlpha()
    .composite([{ input: mask, blend: "dest-in" }])
    .png()
    .toBuffer();

  const outline = await sharp(Buffer.from(faceOutlineSvg(outSize))).png().toBuffer();
  return sharp(cutout).composite([{ input: outline, top: 0, left: 0 }]).png().toBuffer();
}

/** Same oval as styleFace, for SVG clip-path in a head slot sized `slotSize`×`slotSize`. */
export function faceOvalClipPathSvg(slotSize: number): string {
  const { cx, cy, rx, ry } = faceOvalGeometry(slotSize);
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}"/>`;
}
