import assert from 'node:assert/strict';
import {assertMarketplaceDescription} from './marketplace_description_guard.mjs';

const description = [
  'Control supported smart lighting from one Stream Deck with clear live feedback.',
  '',
  'WHAT YOU CAN DO',
  '• Toggle power and supported lighting scenes.',
  '• Adjust brightness and available color presets.',
  '• See status directly on the keys and supported models.',
  '',
  "WHAT'S INCLUDED",
  '• Editable profiles for supported devices.',
  '',
  'QUICK SETUP',
  'Install the local companion and pair the supported lights before assigning actions.',
  '',
  'COMPATIBILITY',
  'Windows. Supported devices, scenes and lighting capabilities vary by model.'
].join('\n');

assert.equal(assertMarketplaceDescription({description}).format,'legacy');
const ok=assertMarketplaceDescription({description,description_format:'structured-v1'});
assert.equal(ok.format,'structured-v1');
assert.equal(ok.benefitBullets,4);
assert.ok(ok.paragraphs>=4);
assert.throws(()=>assertMarketplaceDescription({description:'One giant paragraph without useful sectioning or bullets.',description_format:'structured-v1'}),/250|section/i);
assert.throws(()=>assertMarketplaceDescription({description:description.replaceAll('\n',' '),description_format:'structured-v1'}),/section/i);
assert.throws(()=>assertMarketplaceDescription({description:description.replace('• Toggle','Toggle').replace('• Adjust','Adjust').replace('• See','See'),description_format:'structured-v1'}),/section/i);
assert.throws(()=>assertMarketplaceDescription({description,description_format:'unsupported'}),/Unknown/i);
console.log('MARKETPLACE DESCRIPTION FORMAT PASS: legacy compatibility, headings, bullets, spacing, and strict malformed-copy rejection');
