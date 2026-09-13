import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { patchMakerConsoleSource } from './maker_console_runtime_patch_v6.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const core = readFileSync(join(HERE, 'maker_console_core.mjs'), 'utf8').replace(/\r\n?/g, '\n');
const patched = patchMakerConsoleSource(core, {
  repoRoot: ROOT,
  playwrightUrl: 'file:///ratpack-test/playwright.mjs'
});

assert.match(patched, /\['widget','plugin'\]\.includes\(prod\.type\)/);
assert.match(patched, /prod\.type === 'plugin' \? \/\\\.streamDeckPlugin\$\/i : \/\\\.icuewidget\$\/i/);
assert.match(patched, /productKindLabel = prod\.type === 'plugin' \? 'Plugin' : 'Widget'/);
assert.match(patched, /exactly one \$\{packageExtension\} required/);
assert.match(patched, /if \(prod\.type === 'widget'\) requiredMetadata\.push\('marketplace_dashboard_sizes'\)/);
assert.equal((patched.match(/prod\.marketplace_dashboard_sizes \|\| \[\]/g) || []).length, 2);
assert.match(patched, /Create \$\{productKindLabel\} draft/);
assert.match(patched, /new RegExp\(`\^\$\{productKindLabel\}\$`,'i'\)/);
assert.match(patched, /deleteConfirmedExistingDraft/);
assert.doesNotMatch(patched, /prod\.type !== 'widget'/);
assert.match(patched, /prod\.marketplace_existing_product_update === true/);
assert.match(patched, /runExistingProductVersionUpdate/);
assert.match(patched, /getByRole\('tab',\{name:\/\^versions\$\/i\}\)/);
assert.match(patched, /getByRole\('button',\{name:\/\^create version\$\/i\}\)/);
assert.match(patched, /marketplace_existing_version/);
assert.match(patched, /marketplace_product_id/);
assert.match(patched, /prod\.marketplace_auto_publish !== false/);
assert.match(patched, /auto publish preference mismatch, refusing submit/);
assert.doesNotMatch(patched, /auto publish did not enable/);

const temp = join(tmpdir(), `ratpack-maker-console-${process.pid}.mjs`);
try {
  writeFileSync(temp, patched, 'utf8');
  const checked = spawnSync(process.execPath, ['--check', temp], { encoding: 'utf8' });
  assert.equal(checked.status, 0, `${checked.stdout}\n${checked.stderr}`);
} finally {
  rmSync(temp, { force: true });
}

console.log('RAT SHIP MAKER CONSOLE PATCH PASS: widget + plugin + existing-version update runtime');
