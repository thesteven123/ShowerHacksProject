# Character setup UI — frontend demo

English HTML/CSS/JavaScript for the existing Electron app. No server, external assets, new dependencies, AI API, or segmentation backend is required. Open `index.html` directly to review it.

## Demo flow

Select a file → enter a name → adjust Chaos, Brainrot, Competitive, and Friendliness → **Generate character** → a 1.5-second simulated progress sequence → an animated example character → the editable multi-character roster.

Any selected file is accepted. Supported image files up to 10 MB get a local preview; unsupported, damaged, or oversized files use a placeholder without blocking the next step. Continuing without a name/photo uses a default name/example input. No permission checkbox or backend response blocks this demonstration. Please still use friends' photos with their permission.

The result is a bundled CSS mascot, not a transformation of the uploaded photo. The interface labels it as a demo character and the progress as simulated. Cancel returns to the personality step without adding a character. A cancelled or repeated request cannot add a late/duplicate result. File data and characters stay in memory and disappear on reload/close. The content security policy blocks outgoing connections.

## Integration later

The existing build copies this folder to `dist/ui/setup/`. The integration owner can load that `index.html` in an input-enabled Electron setup window. This change deliberately does not alter app startup, transparent overlay, click-through behavior, preload, backend, dialogue, or game logic.

After adding, editing, or removing a draft, `setup.js` emits a renderer-local `tiny-menaces:setup-drafts-changed` event. The event detail is an array containing:

- `draftId`, `name`, and the four numeric `personality` values.
- `photo`: the original browser File, or null when using the sample.
- `isSample`: whether the input was an example.
- `isDemo: true`, `generationStatus: "simulated"`, and `appearance: { type: "demo-mascot", hue: number }`.

These are demo drafts, not completed `FriendCharacter` records. Later integration must provide actual generation, validated assets, persistence, and a deliberate mapping into the game. Do not treat the demo artwork as a generated photo result.

Runtime files: `index.html`, `studio.css`, `setup.js`. This folder contains no Zo hosting files or credentials.
