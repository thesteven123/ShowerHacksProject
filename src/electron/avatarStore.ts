import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type { FriendCharacter, Vibe } from "../shared/types";

export const MAX_AVATAR_PHOTO_BYTES = 25 * 1024 * 1024;
const MAX_AVATARS = 24;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VIBES = new Set<Vibe>(["chaotic", "dramatic", "supportive"]);

type AvatarBuildInput = {
  id: string;
  name: string;
  vibe: Vibe;
  outputDir: string;
  publicPathPrefix: string;
};

type AvatarBuilder = (photo: Buffer, input: AvatarBuildInput) => Promise<FriendCharacter>;

function avatarImageUrl(root: string, id: string, file: "portrait" | "sheet"): string {
  return pathToFileURL(path.join(root, id, `${id}-${file}.png`)).href;
}

function isAvatar(value: unknown): value is FriendCharacter {
  if (!value || typeof value !== "object") return false;
  const avatar = value as Partial<FriendCharacter>;
  return Boolean(
    typeof avatar.id === "string" && UUID_PATTERN.test(avatar.id) &&
    typeof avatar.name === "string" && avatar.name.trim() && avatar.name.length <= 32 &&
    typeof avatar.imageUrl === "string" && VIBES.has(avatar.vibe as Vibe) &&
    avatar.quotes && Array.isArray(avatar.quotes.idle) &&
    Array.isArray(avatar.quotes.hit) && Array.isArray(avatar.quotes.respawn) &&
    avatar.sprite && typeof avatar.sprite.spriteSheetUrl === "string",
  );
}

export class AvatarStore {
  private readonly root: string;
  private readonly rosterFile: string;
  private readonly selectedFile: string;
  private readonly builder: AvatarBuilder;

  constructor(userDataPath: string, builder?: AvatarBuilder) {
    this.root = path.join(userDataPath, "avatars");
    this.rosterFile = path.join(this.root, "custom-avatars.json");
    this.selectedFile = path.join(this.root, "selected-avatar.json");
    this.builder = builder ?? this.buildCharacter.bind(this);
  }

  private async buildCharacter(photo: Buffer, input: AvatarBuildInput): Promise<FriendCharacter> {
    const { createCharacterFromPhoto } = await import("@tiny-menaces/character-creator");
    return createCharacterFromPhoto(photo, input);
  }

  async list(): Promise<FriendCharacter[]> {
    let raw: string;
    try {
      raw = await readFile(this.rosterFile, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new Error("The saved avatar list is damaged; it was left unchanged.", { cause: error });
    }
    if (!Array.isArray(parsed) || !parsed.every(isAvatar)) {
      throw new Error("The saved avatar list is damaged; it was left unchanged.");
    }
    return parsed;
  }

  async createFromPhoto(photo: Buffer, options: { name: string; vibe: Vibe }): Promise<FriendCharacter> {
    const name = options.name.trim();
    if (!name || name.length > 32 || /[\u0000-\u001f\u007f]/.test(name)) {
      throw new Error("Enter a name between 1 and 32 characters.");
    }
    if (!VIBES.has(options.vibe)) throw new Error("Choose one of the listed personality styles.");
    if (!Buffer.isBuffer(photo) || photo.length === 0 || photo.length > MAX_AVATAR_PHOTO_BYTES) {
      throw new Error("Choose an image smaller than 25 MB.");
    }
    const existing = await this.list();
    if (existing.length >= MAX_AVATARS) {
      throw new Error(`You can save up to ${MAX_AVATARS} custom avatars.`);
    }

    const id = randomUUID();
    const outputDir = path.join(this.root, id);
    const publicPathPrefix = pathToFileURL(`${outputDir}${path.sep}`).href;
    await mkdir(outputDir, { recursive: true });
    try {
      const avatar = await this.builder(photo, { id, name, vibe: options.vibe, outputDir, publicPathPrefix });
      const expectedImageUrl = avatarImageUrl(this.root, id, "portrait");
      const expectedSheetUrl = avatarImageUrl(this.root, id, "sheet");
      if (
        !isAvatar(avatar) || avatar.id !== id || avatar.name !== name || avatar.vibe !== options.vibe ||
        avatar.imageUrl !== expectedImageUrl || avatar.sprite?.spriteSheetUrl !== expectedSheetUrl
      ) {
        throw new Error("Avatar generation returned an invalid result.");
      }
      await Promise.all([
        stat(path.join(outputDir, `${id}-portrait.png`)),
        stat(path.join(outputDir, `${id}-sheet.png`)),
      ]);
      await this.writeList([...existing, avatar]);
      return avatar;
    } catch (error) {
      await rm(outputDir, { recursive: true, force: true }).catch(() => undefined);
      throw error;
    }
  }

  async remove(id: string): Promise<boolean> {
    if (!UUID_PATTERN.test(id)) return false;
    const existing = await this.list();
    if (!existing.some((avatar) => avatar.id === id)) return false;
    await this.writeList(existing.filter((avatar) => avatar.id !== id));
    await rm(path.join(this.root, id), { recursive: true, force: true }).catch((error) => {
      console.warn("Removed avatar data could not be fully cleaned up.", error);
    });
    if (await this.getSelectedId() === id) await rm(this.selectedFile, { force: true });
    return true;
  }

  async getSelectedId(): Promise<string | null> {
    try {
      const parsed: unknown = JSON.parse(await readFile(this.selectedFile, "utf8"));
      return parsed && typeof parsed === "object" && "id" in parsed &&
        typeof parsed.id === "string" && /^[\w-]{1,64}$/.test(parsed.id)
        ? parsed.id
        : null;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      if (error instanceof SyntaxError) return null;
      throw error;
    }
  }

  async setSelectedId(id: string): Promise<void> {
    if (!/^[\w-]{1,64}$/.test(id)) throw new Error("Invalid avatar selection.");
    await mkdir(this.root, { recursive: true });
    await this.atomicWrite(this.selectedFile, `${JSON.stringify({ id }, null, 2)}\n`);
  }

  private async writeList(avatars: FriendCharacter[]): Promise<void> {
    await mkdir(this.root, { recursive: true });
    await this.atomicWrite(this.rosterFile, `${JSON.stringify(avatars, null, 2)}\n`);
  }

  private async atomicWrite(destination: string, content: string): Promise<void> {
    const temporary = `${destination}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, content, { mode: 0o600 });
      await rename(temporary, destination);
    } catch (error) {
      await rm(temporary, { force: true }).catch(() => undefined);
      throw error;
    }
  }
}
