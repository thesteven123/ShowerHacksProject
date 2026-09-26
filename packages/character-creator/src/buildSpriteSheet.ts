import sharp from "sharp";
import { DEFAULT_SPRITE_LAYOUT, type CharacterVibe } from "@tiny-menaces/shared";
import {
  ANKLE_OVERLAP,
  ARM_SLOT,
  ELBOW_OVERLAP,
  FOOT_SLOT,
  FOREARM_SLOT,
  HAND_SLOT,
  HEAD_SLOT,
  LEG_SLOT,
  LEG_V3_SLOT,
  LEGS_Y,
  type ScaledBodyParts,
  type ScaledBodyPartsV3,
  TORSO_SLOT,
  TORSO_Y,
  UPPER_ARM_SLOT,
  WRIST_OVERLAP,
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

function isScaledBodyPartsV3(parts: ScaledBodyParts | ScaledBodyPartsV3): parts is ScaledBodyPartsV3 {
  return "rightUpperArm" in parts;
}

function armChainSvg(
  upper: Buffer,
  fore: Buffer,
  hand: Buffer,
  x: number,
  baseY: number,
  dy: number,
): string {
  const y0 = baseY + dy;
  const yFore = y0 + UPPER_ARM_SLOT.height - ELBOW_OVERLAP;
  const yHand = yFore + FOREARM_SLOT.height - WRIST_OVERLAP;
  return [
    limbImage(upper, x, y0, UPPER_ARM_SLOT.width, UPPER_ARM_SLOT.height),
    limbImage(fore, x, yFore, FOREARM_SLOT.width, FOREARM_SLOT.height),
    limbImage(hand, x, yHand, HAND_SLOT.width, HAND_SLOT.height),
  ].join("\n      ");
}

function legChainSvg(leg: Buffer, foot: Buffer, x: number, legsY: number): string {
  const footY = legsY + LEG_V3_SLOT.height - ANKLE_OVERLAP;
  return [
    limbImage(leg, x, legsY, LEG_V3_SLOT.width, LEG_V3_SLOT.height),
    limbImage(foot, x, footY, FOOT_SLOT.width, FOOT_SLOT.height),
  ].join("\n      ");
}

function frameSvg(
  styledFacePng: Buffer,
  index: number,
  vibe: CharacterVibe,
  headFraming: HeadFramingMode,
  bodyParts?: ScaledBodyParts | ScaledBodyPartsV3,
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

  let backLayers: string;
  let frontArmLayer: string;

  if (bodyParts != null && isScaledBodyPartsV3(bodyParts)) {
    const charRightArmX = torsoX - UPPER_ARM_SLOT.width + 4;
    const charLeftArmX = torsoX + TORSO_SLOT.width - 4;
    const charRightLegX = cx - LEG_V3_SLOT.width - 2 + legSpread;
    const charLeftLegX = cx + 2 + legSpread;

    backLayers = [
      armChainSvg(
        bodyParts.rightUpperArm,
        bodyParts.rightForearm,
        bodyParts.rightHand,
        charRightArmX,
        armY,
        leftArmDy,
      ),
      legChainSvg(bodyParts.rightLeg, bodyParts.rightFoot, charRightLegX, legsY),
      legChainSvg(bodyParts.leftLeg, bodyParts.leftFoot, charLeftLegX, legsY),
    ].join("\n      ");

    frontArmLayer = armChainSvg(
      bodyParts.leftUpperArm,
      bodyParts.leftForearm,
      bodyParts.leftHand,
      charLeftArmX,
      armY,
      rightArmDy,
    );
  } else {
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
    backLayers = [leftArm, leftLeg, rightLeg].join("\n      ");
    frontArmLayer = rightArm;
  }

  const torso =
    bodyParts != null
      ? limbImage(bodyParts.torso, torsoX, torsoY, torsoW, torsoH)
      : limbRect(torsoX, torsoY, torsoW, torsoH, torsoFill, 5);

  return Buffer.from(
    `<svg width="${frameWidth}" height="${frameHeight}" xmlns="http://www.w3.org/2000/svg">
      ${backLayers}
      ${torso}
      ${frontArmLayer}
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
  bodyParts?: ScaledBodyParts | ScaledBodyPartsV3,
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
