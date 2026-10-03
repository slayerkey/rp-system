// Run by the XENEON exact-package CI hook, not against authored browser assets.
import process from 'node:process';
import { runSessionQa } from './session-qa.mjs';

const packagedEntry = process.env.RATPACK_PACKAGED_ENTRY;
if (!packagedEntry) throw new Error('Missing RATPACK_PACKAGED_ENTRY: exact-package QA is required');
await runSessionQa('lite', packagedEntry, 'artifacts/work-session-cross-screen');
