# Character setup UI

English HTML/CSS/JavaScript renderer for the existing Electron app. No web server, React, external assets, or new dependencies are required. Open `index.html` directly to review the UI.

Includes photo selection and preview, name input, four 0–10 personality sliders (Chaos, Brainrot, Competitive, Friendliness), presets, and multiple editable character drafts. Photos remain in memory; closing or reloading clears drafts. Sample artwork is explicitly labeled.

## Integration later

The existing build copies this folder to `dist/ui/setup/`. The Electron integration owner can load that `index.html` in an input-enabled setup window. This PR deliberately does not change the app's current startup, transparent overlay, click-through behavior, preload, backend, or game logic.

`setup.js` emits the renderer-local `tiny-menaces:setup-drafts-changed` event after adding, editing, or removing a draft. Its detail is an array of `{ draftId, name, personality, photo, isSample }`; `photo` is the original browser File or null for the sample. These are creation inputs, not completed `FriendCharacter` records. Conversion to IPC-safe bytes, segmentation, generated assets, persistent storage, and adding completed characters to the game are future integration work.

Only `index.html`, `studio.css`, and `setup.js` are needed at runtime. No Zo hosting files are included.

Verification before submission: JavaScript syntax check, project typecheck, build, and all 24 existing game/simulation tests passed. Browser UI interactions were checked in the standalone preview. A native Electron smoke test was interrupted before its result was verified, so native end-to-end integration is not claimed.
