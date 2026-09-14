import { patchMakerConsoleSource as patchBase } from './maker_console_runtime_patch_v6.mjs';

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Maker Console self-heal patch could not find ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Maker Console self-heal patch found ${label} more than once`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

export function patchMakerConsoleSource(source, options) {
  source = patchBase(source, options);

  source = replaceOnce(
    source,
`async function describeFileInputs(target) {
  return await target.locator('input[type="file"]').evaluateAll(inputs => inputs.map((el,index) => ({
    index,
    id:el.id || '',
    name:el.getAttribute('name') || '',
    accept:el.getAttribute('accept') || '',
    multiple:el.hasAttribute('multiple'),
    outerHTML:el.outerHTML,
    context:(el.closest('label,section,div')?.innerText || '').replace(/\\s+/g,' ').trim().slice(0,500)
  }))).catch(() => []);
}`,
`async function describeFileInputs(target) {
  return await target.locator('input[type="file"]').evaluateAll(inputs => inputs.map((el,index) => {
    const contexts = [];
    let node = el;
    for (let depth = 0; node && depth < 6; depth += 1, node = node.parentElement) {
      const text = String(node.innerText || '').replace(/\\s+/g,' ').trim();
      if (text && !contexts.includes(text)) contexts.push(text.slice(0,700));
    }
    const rect = el.getBoundingClientRect();
    return {
      index,
      id:el.id || '',
      name:el.getAttribute('name') || '',
      accept:el.getAttribute('accept') || '',
      multiple:el.hasAttribute('multiple'),
      outerHTML:el.outerHTML,
      context:contexts.join(' | ').slice(0,1600),
      x:Number.isFinite(rect.x) ? Math.round(rect.x) : null,
      y:Number.isFinite(rect.y) ? Math.round(rect.y) : null
    };
  })).catch(() => []);
}`,
    'file input context collector'
  );

  source = replaceOnce(
    source,
    "    if (/media-app-icon|app icon|search icon|\\bicon\\b/.test(haystack)) score += 20;",
    "    if (/media-app-icon|app icon|search icon|\\bicon\\b|288\\s*[x×]\\s*288|1:1/.test(haystack)) score += 20;",
    'icon scoring hints'
  );

  source = replaceOnce(
    source,
`  const body = await target.locator('body').innerText();
  if (/Thumbnail required|Cover image required/i.test(body)) {
    await mediaDiagnostic(target,'cover upload did not stick');
  }
}`,
`  const body = await target.locator('body').innerText();
  if (/App icon required|Search icon required|Icon required/i.test(body)) {
    await mediaDiagnostic(target,'required app icon upload did not stick');
  }
  if (/Thumbnail required|Cover image required/i.test(body)) {
    await mediaDiagnostic(target,'cover upload did not stick');
  }
}`,
    'required media validation'
  );

  source = replaceOnce(
    source,
`async function editorLooksLikeDetails(target) {`,
`async function editorLooksLikePackage(target) {
  const body = ((await target.locator('body').innerText().catch(() => '')) || '').toLowerCase();
  if (/upload your (?:stream deck )?plugin|only \\.streamdeckplugin files|upload your icue widget|only \\.icuewidget files/.test(body)) return true;
  const inputs = await describeFileInputs(target);
  return inputs.some(info => /streamdeckplugin|icuewidget/.test(String(info.accept || '').toLowerCase()));
}

async function editorLooksLikeDetails(target) {`,
    'package-step recognizer insertion'
  );

  source = replaceOnce(
    source,
`    if (await editorLooksLikeDetails(page)) {
      await step('4-details',prod.type === 'plugin' ? 'Set category, language and price' : 'Set category, dashboard sizes, orientation, language and price',async() => configureDetails(page));
    } else if (await editorLooksLikeMedia(page)) {
      mark('4-details');
    } else if (await finalReviewReady(page)) {`,
`    if (await editorLooksLikePackage(page)) {
      console.log('Existing draft reopened at package upload. Replaying the same verified package and wizard steps safely.');
      const replay = new Set(['2-file','3-copy','4-details','5-media','6-gallery','6-continue','7-notes','8-autopublish']);
      state.done = state.done.filter(id => !replay.has(id));
      state.uploaded = [];
      state.galleryProof = null;
      save();

      await step('2-file',`Upload ${packageExtension}`,async() => {
        page = await livePage();
        const input = page.locator('input[type="file"]').first();
        await input.setInputFiles(join(KIT,packages[0]));
        await click(page,/^(next|continue)$/i,180000);
      });

      await step('3-copy','Verify name and set description',async() => {
        page = await livePage();
        const readonlyName = page.locator('input[readonly][maxlength]').first();
        await readonlyName.waitFor({state:'visible',timeout:10000});
        const name = (await readonlyName.inputValue()).trim();
        if (name !== prod.name) throw new Error(`manifest name mismatch: ${name}`);
        const desc = page.locator('#description').or(page.locator('div[role="textbox"]')).or(page.locator('[contenteditable="true"]')).first();
        await proseMirror(page,desc,readFileSync(join(KIT,'PASTE_description.txt'),'utf8').trim());
        await click(page,/^create product$/i);
        page = await livePage();
      });

      await step('4-details',prod.type === 'plugin' ? 'Set category, language and price' : 'Set category, dashboard sizes, orientation, language and price',async() => configureDetails(page));
    } else if (await editorLooksLikeDetails(page)) {
      await step('4-details',prod.type === 'plugin' ? 'Set category, language and price' : 'Set category, dashboard sizes, orientation, language and price',async() => configureDetails(page));
    } else if (await editorLooksLikeMedia(page)) {
      mark('4-details');
      const replay = new Set(['5-media','6-gallery','6-continue']);
      state.done = state.done.filter(id => !replay.has(id));
      save();
    } else if (await finalReviewReady(page)) {`,
    'resume wizard self-heal branch'
  );

  source = replaceOnce(
    source,
`  await step('6-continue','Continue past media',async() => {
    for (let i=0;i<6;i++) {
      await click(page,/^(next|continue)$/i,30000).catch(() => {});
      await page.waitForTimeout(1800);
      if (!await page.getByRole('button',{name:/^replace$/i}).first().isVisible().catch(() => false)) return;
    }
    throw new Error('media slide would not advance');
  });`,
`  await step('6-continue','Continue past media',async() => {
    for (let i=0;i<6;i++) {
      const clicked = await clickIfVisible(page,/^(next|continue)$/i);
      if (!clicked) break;
      await page.waitForTimeout(1800);
      page = await livePage();
      if (!await editorLooksLikeMedia(page)) return;
      const body = (await page.locator('body').innerText().catch(() => '')) || '';
      if (/App icon required|Search icon required|Icon required/i.test(body)) {
        await mediaDiagnostic(page,'Maker Console still requires an app icon after upload');
      }
      if (/Thumbnail required|Cover image required/i.test(body)) {
        await mediaDiagnostic(page,'Maker Console still requires a thumbnail after upload');
      }
    }
    await mediaDiagnostic(page,'media slide would not advance');
  });`,
    'media continue self-heal'
  );

  return source;
}
