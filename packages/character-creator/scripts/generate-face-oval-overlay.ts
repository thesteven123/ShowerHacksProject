/**
 * PNG overlay matching faceOvalGeometry in src/styleFace.ts (1024×1024).
 */
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const SIZE = 1024;
const cx = SIZE / 2;
const cy = SIZE * 0.48;
const rx = SIZE * 0.36;
const ry = SIZE * 0.42;

const svg = `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${SIZE}" height="${SIZE}" fill="#1a1a24"/>
  <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="#ffffff" stroke-width="6" opacity="0.35"/>
  <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="none" stroke="#7cfac0" stroke-width="4"/>
</svg>`;

async function main() {
  const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
  const dir = path.join(root, "assets", "guides");
  await mkdir(dir, { recursive: true });
  const out = path.join(dir, "face-oval-overlay.png");
  await writeFile(out, await sharp(Buffer.from(svg)).png().toBuffer());
  console.log("Wrote", out);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
