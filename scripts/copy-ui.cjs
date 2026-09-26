const fs = require("node:fs");
const path = require("node:path");

const source = path.resolve(__dirname, "../src/ui");
const destination = path.resolve(__dirname, "../dist/ui");
const builtSource = path.resolve(__dirname, "../packages/character-creator/assets/built");
const builtDestination = path.resolve(destination, "built");

fs.cpSync(source, destination, { recursive: true });

if (fs.existsSync(builtSource)) {
  for (const id of fs.readdirSync(builtSource)) {
    if (id.includes("bbox") || id.includes("template")) continue;
    const from = path.join(builtSource, id);
    if (fs.statSync(from).isDirectory()) {
      fs.cpSync(from, path.join(builtDestination, id), { recursive: true });
    }
  }
}
