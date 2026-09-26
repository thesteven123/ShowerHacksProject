const fs = require("node:fs");
const path = require("node:path");

const source = path.resolve(__dirname, "../src/ui");
const destination = path.resolve(__dirname, "../dist/ui");

fs.cpSync(source, destination, { recursive: true });
