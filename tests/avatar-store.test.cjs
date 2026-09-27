const { after, test } = require("node:test");
const assert = require("node:assert/strict");
const { mkdir, mkdtemp, readFile, rm, stat, writeFile } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { AvatarStore } = require("../dist/electron/avatarStore.js");
const temporaryDirectories = [];

after(async () => {
  await Promise.all(temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true })));
});

function fakeBuilder(photo, input) {
  const portraitPath = path.join(input.outputDir, `${input.id}-portrait.png`);
  const sheetPath = path.join(input.outputDir, `${input.id}-sheet.png`);
  return Promise.all([
    writeFile(portraitPath, photo),
    writeFile(sheetPath, photo),
  ]).then(() => ({
    id: input.id,
    name: input.name,
    imageUrl: pathToFileURL(portraitPath).href,
    vibe: input.vibe,
    quotes: { idle: ["…"], hit: ["Hey!"], respawn: ["I'm back!"] },
    sprite: { spriteSheetUrl: pathToFileURL(sheetPath).href },
  }));
}

async function makeStore() {
  const userData = await mkdtemp(path.join(os.tmpdir(), "tiny-menaces-avatars-"));
  temporaryDirectories.push(userData);
  return { userData, store: new AvatarStore(userData, fakeBuilder) };
}

test("creates a local avatar, selects it, and removes its generated files", async () => {
  const { userData, store } = await makeStore();
  const avatar = await store.createFromPhoto(Buffer.from("test-image"), {
    name: "Casey",
    vibe: "chaotic",
  });

  assert.equal((await store.list()).length, 1);
  assert.equal((await store.list())[0].id, avatar.id);
  await stat(path.join(userData, "avatars", avatar.id, `${avatar.id}-portrait.png`));
  await stat(path.join(userData, "avatars", avatar.id, `${avatar.id}-sheet.png`));

  await store.setSelectedId(avatar.id);
  assert.equal(await store.getSelectedId(), avatar.id);
  assert.equal(await store.remove(avatar.id), true);
  assert.deepEqual(await store.list(), []);
  assert.equal(await store.getSelectedId(), null);
  await assert.rejects(stat(path.join(userData, "avatars", avatar.id)));
});

test("rejects invalid input and does not create avatar files", async () => {
  const { store } = await makeStore();
  await assert.rejects(
    store.createFromPhoto(Buffer.alloc(0), { name: "Casey", vibe: "chaotic" }),
    /image smaller than 25 MB/,
  );
  await assert.rejects(
    store.createFromPhoto(Buffer.from("test-image"), { name: "   ", vibe: "chaotic" }),
    /name between 1 and 32 characters/,
  );
  await assert.rejects(
    store.createFromPhoto(Buffer.from("test-image"), { name: "Casey", vibe: "unknown" }),
    /personality styles/,
  );
  assert.deepEqual(await store.list(), []);
});

test("corrupt saved roster is rejected without silently replacing it", async () => {
  const { userData, store } = await makeStore();
  const roster = path.join(userData, "avatars", "custom-avatars.json");
  await mkdir(path.dirname(roster), { recursive: true });
  await writeFile(roster, "not-json");
  await assert.rejects(store.list(), /damaged/);
  assert.equal(await readFile(roster, "utf8"), "not-json");
});
