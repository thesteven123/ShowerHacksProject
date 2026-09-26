import type { CharacterSpriteSpec, FriendCharacter, SpriteAnimationClip } from "@tiny-menaces/shared";

export type SpriteEntity = {
  character: FriendCharacter;
  x: number;
  y: number;
  clip: keyof FriendCharacter["sprite"]["animations"];
  frameIndex: number;
  clipElapsed: number;
  clipDone: boolean;
};

const imageCache = new Map<string, HTMLImageElement>();

function loadImage(url: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(url);
  if (cached?.complete) return Promise.resolve(cached);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      imageCache.set(url, img);
      resolve(img);
    };
    img.onerror = reject;
    img.src = url;
  });
}

function currentClip(spec: CharacterSpriteSpec, clip: SpriteEntity["clip"]): SpriteAnimationClip {
  return spec.animations[clip];
}

export function advanceEntity(entity: SpriteEntity, dtSec: number): void {
  const spec = entity.character.sprite;
  const anim = currentClip(spec, entity.clip);
  if (entity.clipDone && !anim.loop) return;

  entity.clipElapsed += dtSec;
  const frameDuration = 1 / anim.fps;
  while (entity.clipElapsed >= frameDuration) {
    entity.clipElapsed -= frameDuration;
    if (entity.frameIndex < anim.endFrame) {
      entity.frameIndex += 1;
    } else if (anim.loop) {
      entity.frameIndex = anim.startFrame;
    } else {
      entity.frameIndex = anim.endFrame;
      entity.clipDone = true;
      break;
    }
  }
}

export function playClip(entity: SpriteEntity, clip: SpriteEntity["clip"]): void {
  entity.clip = clip;
  entity.frameIndex = entity.character.sprite.animations[clip].startFrame;
  entity.clipElapsed = 0;
  entity.clipDone = false;
}

/** World click → hit using frame-local hitbox + anchor (same as Person 3 should use). */
export function hitTest(entity: SpriteEntity, worldX: number, worldY: number): boolean {
  const { hitbox, anchor, frameWidth, frameHeight } = entity.character.sprite;
  const frameLeft = entity.x - anchor.x;
  const frameTop = entity.y - anchor.y;
  const hx = frameLeft + hitbox.x;
  const hy = frameTop + hitbox.y;
  return worldX >= hx && worldX <= hx + hitbox.width && worldY >= hy && worldY <= hy + hitbox.height;
}

export async function drawEntity(
  ctx: CanvasRenderingContext2D,
  entity: SpriteEntity,
): Promise<void> {
  const spec = entity.character.sprite;
  const img = await loadImage(spec.spriteSheetUrl);
  const sx = entity.frameIndex * spec.frameWidth;
  const dy = entity.y - spec.anchor.y;
  const dx = entity.x - spec.anchor.x;
  ctx.drawImage(
    img,
    sx,
    0,
    spec.frameWidth,
    spec.frameHeight,
    dx,
    dy,
    spec.frameWidth,
    spec.frameHeight,
  );
}
