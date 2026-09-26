import { clamp } from "./config.js";
import type { Bounds, Clip, Point, SpriteLayout, Target } from "./types.js";

export function hitboxFor(
  target: Pick<Target, "x" | "y" | "scale">,
  layout: SpriteLayout,
) {
  return {
    x: target.x + (layout.hitbox.x - layout.anchor.x) * target.scale,
    y: target.y + (layout.hitbox.y - layout.anchor.y) * target.scale,
    width: layout.hitbox.width * target.scale,
    height: layout.hitbox.height * target.scale,
  };
}
export function contains(
  point: Point,
  box: ReturnType<typeof hitboxFor>,
): boolean {
  return (
    point.x >= box.x &&
    point.x < box.x + box.width &&
    point.y >= box.y &&
    point.y < box.y + box.height
  );
}
export function validateBounds(bounds: Bounds): Bounds {
  if (
    !Number.isFinite(bounds.width) ||
    !Number.isFinite(bounds.height) ||
    bounds.width < 1 ||
    bounds.height < 1
  ) {
    throw new Error(
      "Playable bounds must have positive finite width and height",
    );
  }
  return { ...bounds };
}
export function fittingScale(
  scale: number,
  bounds: Bounds,
  layout: SpriteLayout,
): number {
  return Math.min(
    scale,
    bounds.width / layout.frameWidth,
    bounds.height / layout.frameHeight,
  );
}
export function anchorRange(
  bounds: Bounds,
  scale: number,
  layout: SpriteLayout,
) {
  return {
    minX: layout.anchor.x * scale,
    maxX: bounds.width - (layout.frameWidth - layout.anchor.x) * scale,
    minY: layout.anchor.y * scale,
    maxY: bounds.height - (layout.frameHeight - layout.anchor.y) * scale,
  };
}
export function confine(
  target: Target,
  bounds: Bounds,
  layout: SpriteLayout,
): void {
  const range = anchorRange(bounds, target.scale, layout);
  target.x = clamp(target.x, range.minX, range.maxX);
  target.y = clamp(target.y, range.minY, range.maxY);
}
export function frameFor(
  clip: Clip,
  elapsedMs: number,
  layout: SpriteLayout,
): number {
  const animation = layout.clips[clip];
  const offset = Math.floor((Math.max(0, elapsedMs) * animation.fps) / 1000);
  return animation.frames[
    animation.loop
      ? offset % animation.frames.length
      : Math.min(offset, animation.frames.length - 1)
  ];
}
