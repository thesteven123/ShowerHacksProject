import type { SceneInput, SceneOutput } from "./types.js";

export type SceneProvider = (scene: SceneInput, signal: AbortSignal) => Promise<unknown>;

/** Optional AI adapter: one request in flight, bounded global rate, strict output. */
export class SceneDirector {
  private provider: SceneProvider | null;
  private requestTimes: number[] = [];
  private inFlight = false;
  private offline = false;
  constructor(provider: SceneProvider | null = null) { this.provider = provider; }
  setProvider(provider: SceneProvider | null): void { this.provider = provider; }
  setOffline(offline: boolean): void { this.offline = offline; }

  async suggest(scene: SceneInput, nowMs: number, stillCurrent: () => boolean): Promise<SceneOutput | null> {
    if (!this.provider || this.offline || this.inFlight || !stillCurrent()) return null;
    this.requestTimes = this.requestTimes.filter(time => nowMs - time < 60_000);
    if (this.requestTimes.length >= 2) return null;
    this.requestTimes.push(nowMs);
    this.inFlight = true;
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 2_500);
    try {
      const raw = await this.provider(scene, abort.signal);
      return !abort.signal.aborted && stillCurrent() ? validateSceneOutput(raw, scene) : null;
    } catch { return null; }
    finally { clearTimeout(timeout); this.inFlight = false; }
  }
}

export function validateSceneOutput(raw: unknown, scene: SceneInput): SceneOutput | null {
  if (!raw || typeof raw !== "object") return null;
  const result = raw as Partial<SceneOutput>;
  if (!scene.allowedIntents.includes(result.intent as SceneOutput["intent"])) return null;
  if (!Array.isArray(result.lines) || result.lines.length < 1 || result.lines.length > 3) return null;
  const speakers = new Set(scene.actors.map(actor => actor.id));
  if (!result.lines.every(line => line && typeof line.speakerId === "string" && speakers.has(line.speakerId) && typeof line.text === "string" && line.text.trim().length > 0 && line.text.length <= 100 && !/[<>]/.test(line.text))) return null;
  return { intent: result.intent!, lines: result.lines.map(line => ({ speakerId: line.speakerId, text: line.text.trim() })) };
}

export function offlineScene(scene: SceneInput): SceneOutput {
  const [first, second] = scene.actors;
  if (scene.kind === "drag_release") return {
    intent: "complain", lines: [
      { speakerId: first.id, text: first.vibe === "dramatic" ? "A dramatic entrance would have been nice." : first.vibe === "supportive" ? "Okay! Where are we going?" : "I was plotting something. Now you've moved me." },
      ...(second ? [{ speakerId: second.id, text: "You two going somewhere?" }] : []),
    ],
  };
  if (scene.kind === "prop_prank") return {
    intent: "tease", lines: [{ speakerId: first.id, text: "I decorated your desktop. You're welcome." }],
  };
  const encounterLines = [
    [`What are you plotting, ${second?.name ?? "friend"}?`, "Absolutely nothing. Probably."],
    ["Race you across the desktop?", "You're on."],
    ["You look suspiciously cheerful.", "I found the good snacks."],
  ];
  const sequence = Number(scene.sceneId.match(/\d+$/)?.[0] ?? 1);
  const [opening, reply] = encounterLines[(sequence - 1) % encounterLines.length];
  return { intent: "invite", lines: [
    { speakerId: first.id, text: opening },
    ...(second ? [{ speakerId: second.id, text: reply }] : []),
  ] };
}
