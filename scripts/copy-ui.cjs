const fs = require("node:fs");
const path = require("node:path");

const source = path.resolve(__dirname, "../src/ui");
const destination = path.resolve(__dirname, "../dist/ui");
const builtSource = path.resolve(__dirname, "../packages/character-creator/assets/built");
const builtDestination = path.resolve(destination, "built");

fs.cpSync(source, destination, { recursive: true });

if (fs.existsSync(builtSource)) {
  for (const id of ["kelvin", "maanya", "philip", "steven"]) {
    const from = path.join(builtSource, id);
    if (fs.existsSync(from)) {
      fs.cpSync(from, path.join(builtDestination, id), { recursive: true });
    }
  }
}
