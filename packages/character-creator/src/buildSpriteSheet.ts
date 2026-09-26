import sharp from "sharp";
import { DEFAULT_SPRITE_LAYOUT, type CharacterVibe } from "@tiny-menaces/shared";
import {
  ARM_SLOT,
  HEAD_SLOT,
  LEG_SLOT,
  LEGS_Y,
  type ScaledBodyParts,
  TORSO_SLOT,
  TORSO_Y,
} from "./bodyPartSlots.js";
import type { HeadFramingMode } from "./headFraming.js";
import { faceOvalClipPathSvg } from "./styleFace.js";

const { frameWidth, frameHeight, frameCount } = DEFAULT_SPRITE_LAYOUT;

const BODY_STROKE = "#14141c";

/** Torso/limb fills — light enough to read on the dark preview checkerboard. */
const VIBE_BODY: Record<CharacterVibe, { torso: string; limb: string }> = {
  chaotic: { torso: "#e85a96", limb: "#c44a7e" },
  dramatic: { torso: "#9b86ff", limb: "#7a65d4" },
  supportive: { torso: "#4fd4a0", limb: "#3aab7e" },
};

type FrameOffset = {
  dx: number;
  dy: number;
  legSpread: number;
  headScale: number;
  leftArmDy: number;
  rightArmDy: number;
};

/** Per-frame wobble for idle/walk/hit/respawn strips. */
function frameOffsets(index: number): FrameOffset {
  if (index <= 3) {
    const sway = Math.sin(index) * 2;
    return { dx: 0, dy: sway, legSpread: 0, headScale: 1, leftArmDy: sway, rightArmDy: -sway * 0.6 };
  }
  if (index <= 7) {
    const i = index - 4;
    const swing = i % 2 === 0 ? -5 : 5;
    return {
      dx: i % 2 === 0 ? -2 : 2,
      dy: 0,
      legSpread: i % 2 === 0 ? -3 : 3,
      headScale: 1,
      leftArmDy: swing,
      rightArmDy: -swing,
    };
  }
  if (index <= 10) {
    const flail = (index - 8) * 3;
    return { dx: (index - 8) * 4 - 4, dy: -6, legSpread: 0, headScale: 0.96, leftArmDy: -10 - flail, rightArmDy: -10 + flail };
  }
  return { dx: 0, dy: 8 - (index - 11) * 4, legSpread: 0, headScale: 0.92 + (index - 11) * 0.03, leftArmDy: 4, rightArmDy: 4 };
}

function limbRect(x: number, y: number, w: number, h: number, fill: string, rx = 3): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${BODY_STROKE}" stroke-width="2"/>`;
}

function limbImage(png: Buffer, x: number, y: number, w: number, h: number): string {
  const dataUri = `data:image/png;base64,${png.toString("base64")}`;
  return `<image href="${dataUri}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="xMidYMid meet"/>`;
}

function frameSvg(
  styledFacePng: Buffer,
  index: number,
  vibe: CharacterVibe,
  headFraming: HeadFramingMode,
  bodyParts?: ScaledBodyParts,
): Buffer {
  const { dx, dy, legSpread, headScale, leftArmDy, rightArmDy } = frameOffsets(index);
  const { torso: torsoFill, limb: limbFill } = VIBE_BODY[vibe];
  const cx = frameWidth / 2 + dx;
  const torsoX = cx - TORSO_SLOT.width / 2;
  const headSize = HEAD_SLOT * headScale;
  const headX = cx - headSize / 2;
  const headY = dy;
  const torsoY = TORSO_Y + dy;
  const legsY = LEGS_Y + dy;
  const leftLegX = cx - LEG_SLOT.width - 2 + legSpread;
  const rightLegX = cx + 2 + legSpread;
  const leftArmX = torsoX - ARM_SLOT.width + 4;
  const rightArmX = torsoX + TORSO_SLOT.width - 4;
  const armY = torsoY + 6;
  const faceDataUri = `data:image/png;base64,${styledFacePng.toString("base64")}`;

  const faceClip = faceOvalClipPathSvg(headSize);
  const clipId = `faceClip${index}`;

  const headImage =
    headFraming === "bbox"
      ? `<image href="${faceDataUri}" x="0" y="0" width="${headSize}" height="${headSize}" preserveAspectRatio="xMidYMid meet"/>`
      : `<defs>
          <clipPath id="${clipId}">
            ${faceClip}
          </clipPath>
        </defs>
        <image href="${faceDataUri}" x="0" y="0" width="${headSize}" height="${headSize}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${clipId})"/>`;

  const armW = ARM_SLOT.width;
  const armH = ARM_SLOT.height;
  const legW = LEG_SLOT.width;
  const legH = LEG_SLOT.height;
  const torsoW = TORSO_SLOT.width;
  const torsoH = TORSO_SLOT.height;

  // Facing camera: character's right side is on the viewer's left (leftArmX / leftLegX).
  const leftArm =
    bodyParts != null
      ? limbImage(bodyParts.rightArm, leftArmX, armY + leftArmDy, armW, armH)
      : limbRect(leftArmX, armY + leftArmDy, armW, armH, limbFill);
  const rightArm =
    bodyParts != null
      ? limbImage(bodyParts.leftArm, rightArmX, armY + rightArmDy, armW, armH)
      : limbRect(rightArmX, armY + rightArmDy, armW, armH, limbFill);
  const leftLeg =
    bodyParts != null
      ? limbImage(bodyParts.rightLeg, leftLegX, legsY, legW, legH)
      : limbRect(leftLegX, legsY, legW, legH, limbFill);
  const rightLeg =
    bodyParts != null
      ? limbImage(bodyParts.leftLeg, rightLegX, legsY, legW, legH)
      : limbRect(rightLegX, legsY, legW, legH, limbFill);
  const torso =
    bodyParts != null
      ? limbImage(bodyParts.torso, torsoX, torsoY, torsoW, torsoH)
      : limbRect(torsoX, torsoY, torsoW, torsoH, torsoFill, 5);

  return Buffer.from(
    `<svg width="${frameWidth}" height="${frameHeight}" xmlns="http://www.w3.org/2000/svg">
      ${leftArm}
      ${leftLeg}
      ${rightLeg}
      ${torso}
      ${rightArm}
      <g transform="translate(${headX}, ${headY})">
        ${headImage}
      </g>
    </svg>`,
  );
}

/** Builds a horizontal PNG sprite sheet from a styled face portrait. */
export async function buildSpriteSheet(
  styledFacePng: Buffer,
  vibe: CharacterVibe = "chaotic",
  headFraming: HeadFramingMode = "template",
  bodyParts?: ScaledBodyParts,
): Promise<Buffer> {
  const frames: Buffer[] = [];
  for (let i = 0; i < frameCount; i++) {
    const frame = await sharp(frameSvg(styledFacePng, i, vibe, headFraming, bodyParts)).png().toBuffer();
    frames.push(frame);
  }

  const sheet = sharp({
    create: {
      width: frameWidth * frameCount,
      height: frameHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  });

  const composites = frames.map((input, i) => ({
    input,
    left: i * frameWidth,
    top: 0,
  }));

  return sheet.composite(composites).png().toBuffer();
}
