import { patchMakerConsoleSource as patchBase } from './maker_console_runtime_patch_v3.mjs';

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Maker Console draft-replace patch could not find ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Maker Console draft-replace patch found ${label} more than once`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

export function patchMakerConsoleSource(source, options) {
  source = patchBase(source, options);

  const helper = `
async function deleteConfirmedExistingDraft(target) {
  await target.goto('https://maker.elgato.com/products',{waitUntil:'domcontentloaded',timeout:45000});
  await target.waitForTimeout(2500);

  const matches = target.getByText(prod.name,{exact:true});
  const visibleIndexes = [];
  for (let i = 0; i < await matches.count(); i++) {
    if (await matches.nth(i).isVisible().catch(() => false)) visibleIndexes.push(i);
  }
  if (!visibleIndexes.length) return 'none';
  if (visibleIndexes.length > 1) {
    stopRetrying('More than one visible Maker Console product matches ' + prod.name + '. Rat Ship will not guess which listing is safe to replace.');
  }

  const nameNode = matches.nth(visibleIndexes[0]);
  const proof = await nameNode.evaluate(el => {
    const statuses = /\\b(draft|pending review|in review|under review|submitted|approved|published|rejected|suspended|archived|live)\\b/i;
    let node = el;
    const ancestors = [];
    for (let depth = 0; node && depth < 8; depth++, node = node.parentElement) {
      const text = String(node.innerText || '').replace(/\\s+/g,' ').trim();
      ancestors.push({depth,tag:node.tagName,text:text.slice(0,1600)});
      if (statuses.test(text)) return {text,depth,tag:node.tagName,ancestors};
    }
    return {text:'',depth:null,tag:null,ancestors};
  }).catch(() => ({text:'',depth:null,tag:null,ancestors:[]}));

  writeFileSync(join(LOG,'existing-product-status-proof.json'), JSON.stringify(proof,null,2));
  const statusText = String(proof.text || '');
  const protectedStatus = /\\b(pending review|in review|under review|submitted|approved|published|rejected|suspended|archived|live)\\b/i.exec(statusText)?.[0] || null;
  if (protectedStatus) {
    stopRetrying('Existing ' + prod.name + ' is not an editable draft; Maker Console reports ' + protectedStatus + '. Rat Ship will not modify or delete it.');
  }
  if (!/\\bdraft\\b/i.test(statusText)) {
    stopRetrying('Existing ' + prod.name + ' was found, but Rat Ship could not positively verify Draft status. Nothing was deleted.');
  }

  await snap(target,'confirmed-draft-before-delete');
  console.log('Existing ' + prod.name + ' is confirmed Draft. Deleting the stale draft and recreating it cleanly...');
  await nameNode.click();
  await target.waitForTimeout(1800);
  target = await livePage();

  let deleteControl = target.getByRole('button',{name:/delete product|delete draft|^delete$/i}).or(target.getByRole('link',{name:/delete product|delete draft|^delete$/i})).first();
  if (!await visible(deleteControl)) {
    const actions = target.getByRole('button',{name:/more actions|actions|options|more/i}).first();
    if (await visible(actions)) {
      await actions.click();
      await target.waitForTimeout(300);
      deleteControl = target.getByRole('menuitem',{name:/delete product|delete draft|^delete$/i})
        .or(target.getByRole('button',{name:/delete product|delete draft|^delete$/i}))
        .first();
    }
  }

  if (!await visible(deleteControl)) {
    writeFileSync(join(LOG,'draft-delete-buttons.json'), JSON.stringify(await target.getByRole('button').allTextContents().catch(() => []),null,2));
    throw new Error('Confirmed Draft was found, but Maker Console did not expose a recognizable Delete product control. Nothing was deleted.');
  }

  await deleteControl.click();
  await target.waitForTimeout(500);
  const dialog = target.getByRole('dialog').first();
  if (await visible(dialog)) {
    const dialogText = ((await dialog.innerText().catch(() => '')) || '').replace(/\\s+/g,' ').trim();
    if (!/delete/i.test(dialogText)) {
      throw new Error('Maker Console opened an unexpected dialog while deleting a confirmed draft.');
    }
    const nameInput = dialog.getByRole('textbox').first();
    if (await visible(nameInput)) await nameInput.fill(prod.name);
    const confirm = dialog.getByRole('button',{name:/^delete(?: product| draft)?$/i}).last();
    if (!await visible(confirm)) throw new Error('Draft deletion confirmation did not expose a final Delete button.');
    await confirm.click();
  }

  await target.waitForTimeout(1800);
  await target.goto('https://maker.elgato.com/products',{waitUntil:'domcontentloaded',timeout:45000});
  await target.waitForTimeout(1800);
  if (await target.getByText(prod.name,{exact:true}).first().isVisible().catch(() => false)) {
    throw new Error('Maker Console still shows the confirmed draft after deletion; refusing to create a duplicate.');
  }

  await snap(target,'confirmed-draft-deleted');
  console.log('Deleted confirmed Draft: ' + prod.name);
  return 'deleted';
}
`;

  source = replaceOnce(
    source,
    '\nasync function openExisting(target) {',
    helper + '\nasync function openExisting(target) {',
    'confirmed draft deletion helper insertion point'
  );

  source = replaceOnce(
    source,
    `  } else {\n    editing = await openExisting(page);\n  }\n\n  if (editing) {`,
    `  } else if (RESUME) {\n    editing = await openExisting(page);\n    if (!editing) {\n      await page.waitForTimeout(1500);\n      editing = await openExisting(page);\n    }\n    if (!editing) {\n      console.log('No existing Maker Console draft after two checks; clearing partial wizard state to restart safely.');\n      state.done = [];\n      state.uploaded = [];\n      state.detailsSelections = [];\n      state.detailsProof = [];\n      state.pricingProof = null;\n      state.listboxProof = [];\n      state.galleryProof = null;\n      state.lastUrl = null;\n      save();\n    }\n  } else {\n    await deleteConfirmedExistingDraft(page);\n    editing = false;\n  }\n\n  if (editing) {`,
    'fresh-run existing product handling'
  );

  return source;
}
