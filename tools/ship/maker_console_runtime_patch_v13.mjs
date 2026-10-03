import {patchMakerConsoleSource as patchBase} from './maker_console_runtime_patch_v12.mjs';

function replaceOnce(source, before, after, label) {
  const i=source.indexOf(before);
  if(i<0 || source.indexOf(before,i+before.length)>=0) throw new Error('Superseded draft patch expected one '+label);
  return source.slice(0,i)+after+source.slice(i+before.length);
}

export function patchMakerConsoleSource(source,options) {
  source=patchBase(source,options);

  // Reuse the existing fail-closed deletion helper: it refuses multiple name
  // matches and requires explicit Draft status. Never delete review/published
  // listings or make a fuzzy match based only on the brand.
  const begin=source.indexOf('async function deleteConfirmedExistingDraft(target) {');
  const end=source.indexOf('\nasync function openExisting(target) {',begin);
  if(begin<0 || end<0) throw new Error('Superseded draft patch cannot isolate verified Draft deletion helper');
  const original=source.slice(begin,end);
  const adapted=original
    .replaceAll('prod.name','draftName')
    .replace('async function deleteConfirmedExistingDraft(target) {',
             'async function deleteConfirmedExistingDraft(target, draftName = prod.name) {');
  source=source.slice(0,begin)+adapted+source.slice(end);

  source=replaceOnce(source,
    `  } else {
    await deleteConfirmedExistingDraft(page);
    editing = false;
  }

  if (editing) {`,
    `  } else {
    // Only the explicitly approved former title may be cleaned up, and only
    // when the existing helper confirms the exact listing is still Draft.
    // This prevents re-submission of an identically identified old manifest
    // without deleting a product already sent for Marketplace review.
    for (const priorTitle of (prod.marketplace_superseded_draft_names || [])) {
      if (typeof priorTitle !== 'string' || !priorTitle.trim() || priorTitle === prod.name || !/\\bpack[\\s-]*rat\\b/i.test(priorTitle)) {
        stopRetrying('Invalid explicitly configured superseded Marketplace draft title');
      }
      console.log('Checking exact superseded title for a confirmed Draft: ' + priorTitle);
      await deleteConfirmedExistingDraft(page, priorTitle);
    }
    await deleteConfirmedExistingDraft(page);
    editing = false;
  }

  if (editing) {`,
    'fresh first-submission cleanup');
  return source;
}
