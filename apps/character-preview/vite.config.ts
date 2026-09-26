import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

export default defineConfig({
  server: { port: 5174 },
  publicDir: path.join(repoRoot, "packages/character-creator/assets"),
  resolve: {
    alias: {
      "@tiny-menaces/shared": path.join(repoRoot, "packages/shared/src/index.ts"),
    },
  },
});
