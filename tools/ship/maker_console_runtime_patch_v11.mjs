import { patchMakerConsoleSource as patchBase } from './maker_console_runtime_patch_v10.mjs';

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Maker Console late-icon patch could not find ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Maker Console late-icon patch found ${label} more than once`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

export function patchMakerConsoleSource(source, options) {
  source = patchBase(source, options);

  source = replaceOnce(
    source,
    `  let score = 0;
  if (/image|png|jpe?g|webp/.test(info.accept.toLowerCase())) score += 2;`,
    `  let score = 0;
  const exactId = String(info.id || '').toLowerCase();
  if (kind === 'icon' && exactId === 'media-app-icon') return 100;
  if (/image|png|jpe?g|webp/.test(info.accept.toLowerCase())) score += 2;`,
    'exact app icon score override'
  );

  source = replaceOnce(
    source,
    `  const used = new Set();
  const iconById = target.locator('input#media-app-icon').first();
  if (await iconById.count()) {`,
    `  const used = new Set();
  const iconById = target.locator('input#media-app-icon').first();
  // Maker Console can mount the dedicated app-icon input slightly after the
  // media step becomes visible. Give that exact field time to attach before
  // falling back to heuristic routing.
  await iconById.waitFor({state:'attached',timeout:5000}).catch(() => {});
  if (await iconById.count()) {`,
    'wait for exact app icon input'
  );

  source = replaceOnce(
    source,
    `  const body = await target.locator('body').innerText();
  if (/App icon required|Search icon required|Icon required/i.test(body)) {
    await mediaDiagnostic(target,'required app icon upload did not stick');
  }
  if (/Thumbnail required|Cover image required/i.test(body)) {
    await mediaDiagnostic(target,'cover upload did not stick');
  }`,
    `  let body = await target.locator('body').innerText();
  if (/App icon required|Search icon required|Icon required/i.test(body)) {
    // Some Maker Console renders expose the thumbnail first and mount
    // #media-app-icon only after the cover/gallery UI settles. Recover once by
    // targeting that exact dedicated field; never guess another image input.
    const lateIcon = target.locator('input#media-app-icon').first();
    await lateIcon.waitFor({state:'attached',timeout:5000}).catch(() => {});
    if (await lateIcon.count()) {
      await lateIcon.setInputFiles(join(KIT,'01_search_icon.png'),{timeout:60000});
      await target.waitForTimeout(1800);
      body = await target.locator('body').innerText();
      if (!/App icon required|Search icon required|Icon required/i.test(body)) {
        console.log('Search/app icon: late dedicated Maker Console field');
      }
    }
  }
  if (/App icon required|Search icon required|Icon required/i.test(body)) {
    await mediaDiagnostic(target,'required app icon upload did not stick');
  }
  if (/Thumbnail required|Cover image required/i.test(body)) {
    await mediaDiagnostic(target,'cover upload did not stick');
  }`,
    'late app icon recovery'
  );

  return source;
}
