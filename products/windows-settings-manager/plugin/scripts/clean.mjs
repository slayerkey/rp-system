import { readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const out = fileURLToPath(new URL("../out/", import.meta.url));

let entries = [];
try {
  entries = await readdir(out, { withFileTypes: true });
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

for (const entry of entries) {
  const target = path.join(out, entry.name);

  // Stream Deck can keep the linked .sdPlugin directory itself open on Windows
  // even after its files are no longer in use. Empty the directory in place so
  // rebuilds stay deterministic without trying to rmdir the live plugin root.
  if (entry.isDirectory() && entry.name.endsWith(".sdPlugin")) {
    for (const child of await readdir(target, { withFileTypes: true })) {
      await rm(path.join(target, child.name), {
        recursive: true,
        force: true,
        maxRetries: 8,
        retryDelay: 125
      });
    }
    continue;
  }

  await rm(target, {
    recursive: true,
    force: true,
    maxRetries: 8,
    retryDelay: 125
  });
}
