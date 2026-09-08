const fs = require('fs');
const path = require('path');

// Recovered acceptance harness marker for the v1.0 App Volume integration.
const root = path.resolve(__dirname, '..');
const controller = fs.readFileSync(path.join(root, 'accepted-source', 'app-audio', 'streamdeck-controller.js'), 'utf8');
const surface = fs.readFileSync(path.join(root, 'accepted-source', 'app-audio', 'streamdeck-surface-model.js'), 'utf8');
if (!controller.includes('touchTap') || !controller.includes('dialDown')) throw new Error('accepted App Volume press events missing');
if (!surface.includes('max = 9')) throw new Error('accepted App Volume title limit missing');
console.log('v1.0 App Volume accepted-source contract present');
