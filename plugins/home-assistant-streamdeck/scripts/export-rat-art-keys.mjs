#!/usr/bin/env node
// Product-owned deterministic representative runtime keys; global Rat Ship owns the final photographic cover.
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { render } from '../src/render.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const out = resolve(process.argv[2] || 'dist/rat-art-keys');
const scratch = resolve(out, '.runtime-svg');
const renderer = resolve(root, 'tools/ship/render_svg_icon.mjs');
await rm(out, { recursive: true, force: true });
await mkdir(scratch, { recursive: true });
const T = 1_780_000_000_000;
const entities = new Map([
  ['sensor.living_room_temperature', { entity_id: 'sensor.living_room_temperature', state: '22.1', attributes: { friendly_name: 'Living Temp', unit_of_measurement: '°C' } }],
  ['sensor.home_energy', { entity_id: 'sensor.home_energy', state: '405', attributes: { friendly_name: 'Energy', unit_of_measurement: 'W' } }],
  ['sensor.humidity', { entity_id: 'sensor.humidity', state: '46', attributes: { friendly_name: 'Humidity', unit_of_measurement: '%' } }],
  ['light.desk_lamp', { entity_id: 'light.desk_lamp', state: 'on', attributes: { friendly_name: 'Desk Lamp', supported_color_modes: ['brightness'], brightness: 178 } }],
  ['switch.fan', { entity_id: 'switch.fan', state: 'off', attributes: { friendly_name: 'Desk Fan' } }],
  ['scene.focus', { entity_id: 'scene.focus', state: 'scening', attributes: { friendly_name: 'Focus' } }],
  ['script.good_night', { entity_id: 'script.good_night', state: 'off', attributes: { friendly_name: 'Good Night' } }],
]);
const ha = {
  state: 'LIVE',
  entity: id => entities.get(id) || null,
  liveNumeric: id => { const v = entities.get(id)?.state; return v != null && Number.isFinite(Number(v)) ? Number(v) : null; },
  serviceAvailable: (domain, service) => ({ light: ['turn_on', 'turn_off'], switch: ['turn_on', 'turn_off'], scene: ['turn_on'], script: ['turn_on'] }[domain] || []).includes(service),
  history: new Map([
    ['sensor.living_room_temperature', { series: () => [[T-60000, 21.4], [T-45000,21.7], [T-30000,21.6], [T-15000,22.0], [T,22.1]] }],
    ['sensor.home_energy', { series: () => [[T-60000, 360], [T-45000, 390], [T-30000,365], [T-15000,412], [T,405]] }],
  ]),
};
const triple = ['sensor.living_room_temperature', 'sensor.home_energy', 'sensor.humidity'];
const keys = [
  ['overview', { entityIds: triple }],
  ['status', { entityId: triple[0] }],
  ['status', { entityId: triple[1] }],
  ['status', { entityId: triple[2] }],
  ['graph', { entityId: triple[0], windowMs: 60000 }],
  ['graph', { entityId: triple[1], windowMs: 60000 }],
  ['control', { entityId: 'light.desk_lamp' }],
  ['control', { entityId: 'switch.fan' }],
  ['trigger', { entityId: 'scene.focus' }],
  ['trigger', { entityId: 'script.good_night' }],
  ['overview', { entityIds: [triple[1], triple[2], triple[0]] }],
  ['status', { entityId: 'light.desk_lamp' }],
  ['status', { entityId: 'switch.fan' }],
  ['status', { entityId: triple[0] }],
  ['control', { entityId: 'light.desk_lamp' }],
];
for (let i = 0; i < keys.length; i += 1) {
  const [kind, settings] = keys[i];
  const svg = render(ha, kind, settings);
  const src = resolve(scratch, String(i).padStart(2, '0') + '.svg');
  const dst = resolve(out, String(i).padStart(2, '0') + '.png');
  await writeFile(src, svg, 'utf8');
  const result = spawnSync(process.execPath, [renderer, src, dst], { cwd: root, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`Canonical SVG renderer failed for key ${i}`);
}
await rm(scratch, { recursive: true, force: true });
console.log('RAT ART: 15 exact representative runtime key faces (illustrative Home Assistant fixture data)');
