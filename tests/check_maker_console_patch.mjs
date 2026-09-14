import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { patchMakerConsoleSource } from '../tools/ship/maker_console_runtime_patch_v7.mjs';

const core = readFileSync(resolve('tools/ship/maker_console_core.mjs'), 'utf8').replace(/\r\n?/g, '\n');

function check(label, source) {
  const patched = patchMakerConsoleSource(source.replace(/\r\n?/g, '\n'), {
    repoRoot: 'C:\\RatPack',
    playwrightUrl: 'file:///C:/RatPack/tools/node_modules/playwright/index.mjs'
  });

  const required = [
    'selected.length && JSON.stringify(selected) !== JSON.stringify(pending)',
    'async function selectCategoryValues(target, requestedValues)',
    "await selectCategoryValues(target, prod.marketplace_category);",
    "if (paidState === true && freeState !== true) return {mode:'paid'",
    "if (!RESUME) {",
    'state.lastUrl = page.url()',
    "console.log('Resuming ' + prod.name + ' at the last verified Maker Console step.')",
    'async function deleteConfirmedExistingDraft(target)',
    "Existing ' + prod.name + ' is confirmed Draft. Deleting the stale draft and recreating it cleanly...",
    "Maker Console reports ' + protectedStatus + '. Rat Ship will not modify or delete it.",
    'await deleteConfirmedExistingDraft(page);',
    'async function editorLooksLikePackage(target)',
    "Existing draft reopened at package upload. Replaying the same verified package and wizard steps safely.",
    "state.uploaded = [];",
    "required app icon upload did not stick",
    "Maker Console still requires an app icon after upload",
    "288\\s*[x×]\\s*288"
  ];

  for (const needle of required) {
    if (!patched.includes(needle)) throw new Error(`${label}: missing patched marker: ${needle}`);
  }
  console.log(`PASS ${label}`);
}

check('LF core', core);
check('Windows CRLF core', core.replace(/\n/g, '\r\n'));
