import sharp from "sharp";

/** A = fixed template oval; B = subject bounding box scaled into head slot (sticker). */
export type HeadFramingMode = "template" | "bbox";

export type SubjectRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

const DEFAULT_THRESHOLD = 22;

function isSubjectPixel(r: number, g: number, b: number, a: number, threshold: number): boolean {
  if (a < 8) return false;
  return Math.max(r, g, b) > threshold;
}

/** Opaque JPEG letterbox / matte → transparent using the same rule as findSubjectRect. */
export async function applySubjectAlpha(
  image: Buffer,
  threshold = DEFAULT_THRESHOLD,
): Promise<Buffer> {
  const { data, info } = await sharp(image).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels } = info;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * channels;
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      const a = data[i + 3]!;
      if (!isSubjectPixel(r, g, b, a, threshold)) {
        data[i + 3] = 0;
      }
    }
  }

  return sharp(data, { raw: { width: w, height: h, channels: 4 } }).png().toBuffer();
}

/**
 * Tight bbox of non-background pixels (alpha or dark JPEG on black).
 */
export async function findSubjectRect(
  image: Buffer,
  threshold = DEFAULT_THRESHOLD,
): Promise<SubjectRect | null> {
  const { data, info } = await sharp(image).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels } = info;

  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * channels;
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      const a = data[i + 3]!;
      if (!isSubjectPixel(r, g, b, a, threshold)) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) return null;

  return {
    left: minX,
    top: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
  };
}

/**
 * Scale subject bbox to fit inside a square canvas with padding (mode B). No geometric oval mask.
 */
export async function fitSubjectInSquare(
  image: Buffer,
  outSize: number,
  paddingRatio = 0.06,
): Promise<{ buffer: Buffer; subjectRect: SubjectRect | null }> {
  const rect = await findSubjectRect(image);
  if (!rect) {
    const resized = await sharp(image)
      .resize(outSize, outSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    const buffer = await applySubjectAlpha(resized);
    return { buffer, subjectRect: null };
  }

  const cropped = await sharp(image)
    .extract({ left: rect.left, top: rect.top, width: rect.width, height: rect.height })
    .png()
    .toBuffer();

  const inner = Math.max(1, Math.round(outSize * (1 - paddingRatio * 2)));
  const fitted = await sharp(cropped)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const meta = await sharp(fitted).metadata();
  const fw = meta.width ?? inner;
  const fh = meta.height ?? inner;
  const left = Math.floor((outSize - fw) / 2);
  const top = Math.floor((outSize - fh) / 2);

  const composed = await sharp({
    create: {
      width: outSize,
      height: outSize,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: fitted, left, top }])
    .png()
    .toBuffer();

  const buffer = await applySubjectAlpha(composed);
  return { buffer, subjectRect: rect };
}

/** Debug overlay: subject rect on scaled source. */
export async function drawSubjectRectOverlay(image: Buffer, rect: SubjectRect | null): Promise<Buffer> {
  if (!rect) return image;
  const meta = await sharp(image).metadata();
  const w = meta.width ?? 256;
  const h = meta.height ?? 256;
  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <rect x="${rect.left}" y="${rect.top}" width="${rect.width}" height="${rect.height}"
      fill="none" stroke="#00ff88" stroke-width="2"/>
  </svg>`;
  return sharp(image).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).png().toBuffer();
}
