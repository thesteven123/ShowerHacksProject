# Builder: two photos → part crops → avatar

Friends follow [friend-photo-guide.md](./friend-photo-guide.md) (**two photos only**). This doc is for whoever builds roster characters.

## Workflow overview

```text
Friend: face photo + full-body photo
    → save under assets/sources/<slug>/
    → lasso tool: cut torso / arms / legs from full-body
    → copy face photo as *1* file
    → face-crop:avatar --body photo --roster
    → npm run preview / verify:preview
```

## Step 1 — Save incoming photos

Create `packages/character-creator/assets/sources/<slug>/` (e.g. `kelvin`).

| File | Source |
| --- | --- |
| Face (`*1*` / `*1crop*`) | Photo A from friend — copy/rename e.g. `kelvin1.jpg` |
| Full body (reference) | Photo B — any name e.g. `kelvin-fullbody.jpg` (used only in lasso tool until exported) |

## Step 2 — Lasso part crops (Phase 2)

Open the part lasso app from repo root:

```bash
npm run lasso
```

Then in the browser (http://localhost:5175):

1. Enter **slug** (e.g. `kelvin`).
2. Load the **full-body** image.
3. Optionally load the **face** image (exported as `\<slug\>1crop.png` with the batch).
4. For each part, select the slot and draw a **lasso** (click points around the region, double-click or **Close lasso** to finish):
   - **2** — torso  
   - **3** — right arm (character’s right, on your left in a mirror selfie — **character-facing** as in README)  
   - **4** — left arm  
   - **5** — right leg  
   - **6** — left leg  
5. **Export crops** — pick the source folder (`assets/sources/<slug>/`) so files land as `\<slug\>2.png` … `\<slug\>6.png` plus face if provided.

Part filename rules match [`resolvePartCropPaths`](../packages/character-creator/src/resolvePartCrops.ts) (`*2*` … `*6*` in the name).

## Step 3 — Build avatar + roster

From repo root:

```bash
npm run face-crop:avatar -- packages/character-creator/assets/sources/<slug> \
  --body photo --slug <slug> --name "<Display Name>" --roster
```

Optional head framing:

- `--framing bbox` (default) — cutout / sticker head  
- `--framing template` — strict in-game oval ([`styleFace`](../packages/character-creator/src/styleFace.ts))

Outputs: `packages/character-creator/assets/built/<slug>/` and upsert into `characters.json`.

## Step 4 — Verify

```bash
npm run verify:preview
npm run preview
```

Select the friend in the preview roster; check idle/walk/hit clips and hitbox clicks.

---

## Phase 3 (future — not implemented)

- **Autosplit** full-body into torso/limbs with ML or heuristics.  
- **Extra reference photos** per part if lasso quality is insufficient.

Until then, lasso + two friend photos is the supported path. Autosplit will plug into the same `*2*`…`*6*` folder convention and CLI.
