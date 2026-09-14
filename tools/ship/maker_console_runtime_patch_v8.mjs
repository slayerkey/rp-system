import { patchMakerConsoleSource as patchBase } from './maker_console_runtime_patch_v7.mjs';

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Maker Console media-section patch could not find ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Maker Console media-section patch found ${label} more than once`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

export function patchMakerConsoleSource(source, options) {
  source = patchBase(source, options);

  const helper = `
async function uploadThroughNamedMediaSection(target, headingPattern, filePath, stopHeadingPattern = null) {
  const heading = target.getByText(headingPattern,{exact:true}).first();
  if (!await visible(heading)) return false;

  const headingBox = await heading.boundingBox().catch(() => null);
  if (!headingBox) return false;

  let stopY = Number.POSITIVE_INFINITY;
  if (stopHeadingPattern) {
    const stop = target.getByText(stopHeadingPattern,{exact:true}).first();
    if (await visible(stop)) {
      const stopBox = await stop.boundingBox().catch(() => null);
      if (stopBox) stopY = stopBox.y;
    }
  }

  const inputs = target.locator('input[type="file"]');
  for (let i = 0; i < await inputs.count(); i++) {
    const input = inputs.nth(i);
    const section = await input.evaluate((el) => {
      let node = el;
      for (let depth = 0; node && depth < 7; depth += 1, node = node.parentElement) {
        const text = String(node.innerText || '').replace(/\\s+/g,' ').trim();
        if (/thumbnail/i.test(text)) return true;
        if (/gallery/i.test(text) && !/thumbnail/i.test(text)) return false;
      }
      return false;
    }).catch(() => false);
    if (section) {
      await input.setInputFiles(filePath,{timeout:60000});
      return true;
    }
  }

  const clickable = target.locator('button,[role="button"],label');
  const candidates = [];
  for (let i = 0; i < await clickable.count(); i++) {
    const node = clickable.nth(i);
    if (!await visible(node)) continue;
    const box = await node.boundingBox().catch(() => null);
    if (!box) continue;
    const centerY = box.y + box.height / 2;
    if (centerY < headingBox.y || centerY >= stopY) continue;

    const name = (((await node.getAttribute('aria-label').catch(() => '')) || '') + ' ' +
      ((await node.getAttribute('title').catch(() => '')) || '') + ' ' +
      ((await node.textContent().catch(() => '')) || '')).replace(/\\s+/g,' ').trim();
    if (/continue|save for later|replace|remove|delete/i.test(name)) continue;

    candidates.push({index:i,x:box.x,y:box.y,width:box.width,height:box.height,name});
  }

  candidates.sort((a,b) => {
    const ay = Math.abs(a.y - headingBox.y);
    const by = Math.abs(b.y - headingBox.y);
    if (ay !== by) return ay - by;
    return b.x - a.x;
  });

  writeFileSync(join(LOG,'media-section-candidates.json'), JSON.stringify({
    heading:String(headingPattern),
    headingBox,
    stopY:Number.isFinite(stopY) ? stopY : null,
    candidates
  },null,2));

  for (const candidate of candidates) {
    const node = clickable.nth(candidate.index);
    try {
      const chooserPromise = target.waitForEvent('filechooser',{timeout:4000});
      await node.click();
      const chooser = await chooserPromise;
      await chooser.setFiles(filePath);
      return true;
    } catch {}
  }

  return false;
}
`;

  source = replaceOnce(
    source,
    "\nasync function setIconAndCover(target) {",
    helper + "\nasync function setIconAndCover(target) {",
    'named media section helper insertion point'
  );

  source = replaceOnce(
    source,
`  if (!cover) await mediaDiagnostic(target,'cover upload input not found on Maker Console media step');

  if (cover.locator) await cover.locator.setInputFiles(join(KIT,'02_cover.png'),{timeout:60000});
  await target.waitForTimeout(1800);`,
`  if (!cover) {
    const uploaded = await uploadThroughNamedMediaSection(
      target,
      /^Thumbnail$/i,
      join(KIT,'02_cover.png'),
      /^Gallery$/i
    );
    if (uploaded) cover = {locator:null,index:-1,info:{method:'thumbnail-section-filechooser'}};
  }

  if (!cover) {
    const current = await describeFileInputs(target);
    const inputs = target.locator('input[type="file"]');
    const fallback = current.filter(info => {
      const accept = String(info.accept || '').toLowerCase();
      const context = (String(info.id || '') + ' ' + String(info.name || '') + ' ' + String(info.context || '')).toLowerCase();
      const image = /image|png|jpe?g|webp/.test(accept);
      const forbidden = /media-app-icon|app icon|search icon|gallery|additional media|screenshots/.test(context);
      return image && !info.multiple && !forbidden;
    });
    if (fallback.length === 1) {
      cover = {locator:inputs.nth(fallback[0].index),index:fallback[0].index,info:{...fallback[0],method:'single-unlabeled-image-input'}};
    }
  }

  if (!cover) await mediaDiagnostic(target,'cover upload input not found on Maker Console media step');

  if (cover.locator) await cover.locator.setInputFiles(join(KIT,'02_cover.png'),{timeout:60000});
  await target.waitForTimeout(1800);`,
    'thumbnail section fallback'
  );

  return source;
}
