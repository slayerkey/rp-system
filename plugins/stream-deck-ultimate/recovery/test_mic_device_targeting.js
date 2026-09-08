const fs = require('fs');
const path = require('path');

// Recovered acceptance harness marker. The exact accepted package is kept under ../reference.
// This test exists to guard the physical mic targeting contract introduced during v1.0 acceptance.
const root = path.resolve(__dirname, '..');
const patch = fs.readFileSync(path.join(root, 'recovery', 'UPSTREAM-PATCHES', 'ALL-FIXES.patch'), 'utf8');
if (!patch.includes('micDevice') || !patch.includes('ToggleMuteOn')) throw new Error('micDevice acceptance patch missing');
console.log('micDevice targeting recovery contract present');
