import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {assertMarketplaceTitle} from './marketplace_title_guard.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
for (const bad of [
  'PackRat Smart Lighting for Hue & Govee',
  'PACKRAT Monitor Pro',
  'Pack Rat Smart Lighting',
  'pack-rat calendar',
  'My PackRat Control'
]) assert.throws(() => assertMarketplaceTitle(bad),/cannot contain PackRat/);
for (const good of [
  'Smart Lighting for Hue & Govee',
  'Performance Grapher',
  'Ratchet Control',
  'Smart Lighting Control'
]) assert.equal(assertMarketplaceTitle(good),good);
assert.throws(() => assertMarketplaceTitle('   '),/is empty/);
const router = readFileSync(resolve(HERE,'../local/rat-marketplace.ps1'),'utf8');
assert.match(router, /\(\?i\)\\bpack\[\\s-\]\*rat\\b/);
const maker = readFileSync(resolve(HERE,'maker_console.mjs'),'utf8');
assert.match(maker,/assertMarketplaceTitle\(kitProduct\.name/);
const standard = readFileSync(resolve(HERE,'../../standards/marketplace-listing-v2.md'),'utf8');
assert.match(standard,/Marketplace product titles must never contain/);
console.log('GLOBAL MARKETPLACE TITLE PASS: five rejected brand-prefixed names, four allowed names, shared command/browser gates');
