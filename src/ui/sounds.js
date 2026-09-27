let audioCtx = null;

function context() {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

function tone(ctx, frequency, start, duration, type = "sine", gain = 0.12) {
  const oscillator = ctx.createOscillator();
  const amp = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  amp.gain.setValueAtTime(gain, start);
  amp.gain.exponentialRampToValueAtTime(0.001, start + duration);
  oscillator.connect(amp);
  amp.connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration);
}

function noiseBurst(ctx, start, duration, gain = 0.08) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  }
  const source = ctx.createBufferSource();
  const amp = ctx.createGain();
  source.buffer = buffer;
  amp.gain.setValueAtTime(gain, start);
  amp.gain.exponentialRampToValueAtTime(0.001, start + duration);
  source.connect(amp);
  amp.connect(ctx.destination);
  source.start(start);
}

function playReactionSound(sound) {
  const ctx = context();
  if (ctx.state === "suspended") void ctx.resume();
  const now = ctx.currentTime;

  switch (sound) {
    case "bonk":
      noiseBurst(ctx, now, 0.08, 0.1);
      tone(ctx, 180, now, 0.16, "square", 0.14);
      tone(ctx, 90, now + 0.02, 0.18, "sine", 0.1);
      break;
    case "oof":
      tone(ctx, 320, now, 0.18, "triangle", 0.12);
      tone(ctx, 180, now + 0.08, 0.2, "triangle", 0.1);
      break;
    case "gasp":
      tone(ctx, 420, now, 0.08, "sine", 0.08);
      tone(ctx, 640, now + 0.07, 0.16, "sine", 0.1);
      break;
    case "cheer":
      tone(ctx, 523, now, 0.12, "triangle", 0.08);
      tone(ctx, 659, now + 0.08, 0.12, "triangle", 0.08);
      tone(ctx, 784, now + 0.16, 0.18, "triangle", 0.1);
      break;
    case "pop":
      tone(ctx, 700, now, 0.07, "sine", 0.11);
      tone(ctx, 420, now + 0.04, 0.08, "sine", 0.07);
      break;
    case "dramatic":
      tone(ctx, 196, now, 0.28, "sawtooth", 0.06);
      tone(ctx, 233, now + 0.05, 0.3, "sawtooth", 0.05);
      tone(ctx, 294, now + 0.12, 0.34, "triangle", 0.07);
      break;
    case "giggle":
      tone(ctx, 880, now, 0.07, "square", 0.05);
      tone(ctx, 988, now + 0.07, 0.07, "square", 0.05);
      tone(ctx, 784, now + 0.14, 0.1, "square", 0.05);
      break;
    default:
      tone(ctx, 440, now, 0.1, "sine", 0.08);
  }
}

function unlockAudio() {
  const ctx = context();
  if (ctx.state === "suspended") void ctx.resume();
}

function playSound(name) {
  if (!name) return;
  unlockAudio();
  playReactionSound(name);
}
