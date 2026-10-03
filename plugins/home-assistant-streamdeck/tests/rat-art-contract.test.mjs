import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const src = async name => readFile(new URL(name, import.meta.url), 'utf8');
test('product Rat Art exports actual runtime renderer faces, not marketing redraws', async () => {
  const js = await src('../scripts/export-rat-art-keys.mjs');
  assert.match(js, /import\s*\{\s*render\s*\}\s*from\s*['"]\.\.\/src\/render\.js/);
  assert.match(js, /render\(ha,\s*kind,\s*settings\)/);
  assert.match(js, /tools\/ship\/render_svg_icon\.mjs/);
  assert.match(js, /const keys = \[/);
  assert.match(js, /keys\.length/);
});
test('product Rat Art depends on canonical approval surfaces', async () => {
  const ps = await src('../rat-art.ps1');
  const py = await src('../scripts/rat_art.py');
  assert.match(ps, /ratpack-icon-transparent\.png/);
  assert.match(ps, /export-rat-art-keys\.mjs/);
  assert.doesNotMatch(ps, /render_streamdeck_ship_hero\.py/); // final cover remains global Rat Ship-owned
  assert.match(py, /xeneon_all_hero_batch import F/);
  assert.match(py, /ILLUSTRATIVE TEST VALUES/);
  for (const filename of ['01_search_icon.png','03_gallery_01.png','04_gallery_02.png','05_gallery_03.png','06_gallery_04.png']) assert(py.includes(filename));
});

test('Marketplace title matches actual manifest and does not duplicate the shared cover subtitle', async () => {
  const submission = JSON.parse(await src('../submission.json'));
  const manifest = JSON.parse(await src('../com.packrat.home-assistant-streamdeck.sdPlugin/manifest.json'));
  assert.equal(submission.name, manifest.Name);
  assert.doesNotMatch(submission.name, /\bfor\s+stream\s*deck\b/i);
});
