import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { runInNewContext } from 'node:vm';
import { patchMakerConsoleSource } from './maker_console_runtime_patch_v12.mjs';

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
assert.match(patched, /state\.versionUpdateStarted = true/);
assert.match(patched, /prior Rat Ship attempt already opened the Create version flow/);

// The current PackRat recovery ZIP captured Create product still spinning on the
// description slide. Prove the real transition helper waits for hydrated Details
// instead of recording 3-copy after a fixed 900 ms delay.
assert.match(patched, /async function waitForDetailsAfterCreate\(/);
assert.match(patched, /page = await waitForDetailsAfterCreate\(page, 'fresh create product'\)/);
assert.match(patched, /target = await waitForDetailsAfterCreate\(target, 'configure details'\)/);
assert.match(patched, /editorLooksLikeCopy\(page\)/);
assert.match(patched, /waitForDetailsAfterCreate\(page, 'resumed description create product'\)/);

assert.match(patched, /No existing Maker Console draft after two checks/);
assert.match(patched, /editing = await openExisting\(page\);\s+if \(!editing\) \{\s+await page.waitForTimeout\(1500\);/);
// The owner recovery ZIP uses /<organization-id>/create/plugins, not /create/*.
const createWizardPath = /^https:\/\/maker\.elgato\.com\/(?:[^\/?#]+\/)?create(?:\/|[?#]|$)/i;
assert.equal(createWizardPath.test('https://maker.elgato.com/create/plugins'),true);
assert.equal(createWizardPath.test('https://maker.elgato.com/6ca8662c-1988-4901-8058-f5929450a596/create/plugins'),true);
assert.equal(createWizardPath.test('https://maker.elgato.com/products'),false);
assert.equal(createWizardPath.test('https://maker.elgato.com/6ca8662c-1988-4901-8058-f5929450a596/products'),false);
const resumeGuardLine = patched.split('\n').find(line => line.includes('if (RESUME && state.lastUrl') && line.includes('&& !') && line.includes('create'));
assert.ok(resumeGuardLine, 'patched runtime must contain a create-wizard resume exclusion');
const literal = resumeGuardLine.split('&& !')[1].split('.test(state.lastUrl)')[0].trim();
const closing = literal.lastIndexOf('/');
assert.ok(literal.startsWith('/') && closing > 0, 'expected regex literal in patched create-wizard guard');
const emittedGuard = new RegExp(literal.slice(1,closing),literal.slice(closing+1));
assert.equal(emittedGuard.test('https://maker.elgato.com/create/plugins'),true);
assert.equal(emittedGuard.test('https://maker.elgato.com/6ca8662c-1988-4901-8058-f5929450a596/create/plugins'),true);
assert.equal(emittedGuard.test('https://maker.elgato.com/products'),false);


const begin = core.indexOf('async function waitForDetailsAfterCreate(');
const end = core.indexOf('\nasync function editorLooksLikeDetails(', begin);
assert.ok(begin > 0 && end > begin, 'transition helper must have stable source boundaries');
const transitionSource = core.slice(begin, end);

async function runTransitionFixture({hydrateAt = Infinity, listboxesAt = Infinity, maxWaitMs = 75000}) {
  let now = 0, polls = 0;
  const reports = [], snaps = [];
  const target = {
    url: () => 'https://maker.elgato.com/mock/create/plugins',
    locator: name => ({
      count: async () => name.includes('aria-haspopup') && polls >= listboxesAt ? 2 : 0,
      first: () => ({ mockedDescription: true }),
      innerText: async () => 'Create product loading spinner'
    }),
    getByRole: () => ({allTextContents: async () => ['Create product']}),
    waitForTimeout: async ms => { now += ms; polls++; }
  };
  const context = {
    Date: { now: () => now },
    livePage: async () => target,
    editorLooksLikeDetails: async () => polls >= hydrateAt,
    visible: async () => polls < hydrateAt,
    snap: async (_,label) => { snaps.push(label); },
    writeFileSync: (_,payload) => { reports.push(JSON.parse(payload)); },
    join: (...parts) => parts.join('/'),
    LOG: '/fixture'
  };
  runInNewContext(transitionSource + '\nthis.waitForDetailsAfterCreate = waitForDetailsAfterCreate;', context);
  let result = null, failure = null;
  try { result = await context.waitForDetailsAfterCreate(target,'fixture copy transition'); }
  catch (error) { failure = String(error.message); }
  return {result,failure,now,polls,reports,snaps};
}
const hydrated = await runTransitionFixture({hydrateAt:2,listboxesAt:5});
assert.equal(hydrated.failure, null);
assert.ok(hydrated.polls >= 5, 'must not advance when details heading appears before category hydration');
assert.ok(hydrated.now < 75000, 'hydrated transition should not time out');
const stuck = await runTransitionFixture({});
assert.match(stuck.failure,/did not advance to the details screen/);
assert.equal(stuck.reports[0].sawDescription, true);
assert.equal(stuck.reports[0].sawDetails, false);
assert.ok(stuck.snaps.includes('details-transition-timeout'));
const missingControls = await runTransitionFixture({hydrateAt:2});
assert.match(missingControls.failure,/category selectors did not mount/);
assert.equal(missingControls.reports[0].sawDetails, true);
assert.equal(missingControls.reports[0].categoryListboxCount, 0);
console.log('MAKER CONSOLE COPY TRANSITION PASS: hydration race, stalled spinner, and missing listbox diagnostics');


const temp = join(tmpdir(), `ratpack-maker-console-${process.pid}.mjs`);
try {
  writeFileSync(temp, patched, 'utf8');
  const checked = spawnSync(process.execPath, ['--check', temp], { encoding: 'utf8' });
  assert.equal(checked.status, 0, `${checked.stdout}\n${checked.stderr}`);
} finally {
  rmSync(temp, { force: true });
}

console.log('RAT SHIP MAKER CONSOLE PATCH PASS: widget + plugin + existing-version update runtime');
