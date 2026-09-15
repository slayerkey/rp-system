import { patchMakerConsoleSource as patchBase } from './maker_console_runtime_patch_v11.mjs';

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Maker Console transient-retry patch could not find ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Maker Console transient-retry patch found ${label} more than once`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

function replaceCount(source, before, after, expected, label) {
  const parts = source.split(before);
  const count = parts.length - 1;
  if (count !== expected) {
    throw new Error(`Maker Console transient-retry patch expected ${expected} ${label} blocks, found ${count}`);
  }
  return parts.join(after);
}

export function patchMakerConsoleSource(source, options) {
  source = patchBase(source, options);

  const helper = `
async function recoverMakerConsoleTransientError(target, phase = 'current step') {
  const retry = target.getByRole('button',{name:/^(try again|retry)$/i})
    .or(target.getByRole('link',{name:/^(try again|retry)$/i})).first();
  if (!await visible(retry)) return false;

  const body = ((await target.locator('body').innerText().catch(() => '')) || '');
  if (!/unexpected error|something went wrong|temporarily unavailable|failed to load|try again|retry/i.test(body)) {
    return false;
  }

  await snap(target, 'transient-error-before-retry');
  state.transientRecoveries ||= [];
  state.transientRecoveries.push({
    phase,
    url: target.url(),
    at: new Date().toISOString(),
    body: body.replace(/\\s+/g,' ').trim().slice(0,1200)
  });
  save();

  console.log('Maker Console transient error during ' + phase + '; clicking Try again once and continuing.');
  await retry.click({timeout:15000});
  await target.waitForLoadState('domcontentloaded',{timeout:30000}).catch(() => {});
  await target.waitForTimeout(1800);
  return true;
}

async function waitForPackageInputWithTransientRecovery(target) {
  for (let cycle = 0; cycle < 2; cycle++) {
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      const input = target.locator('input[type="file"]').first();
      if (await input.count()) return input;

      const recovered = await recoverMakerConsoleTransientError(target,'package upload');
      if (recovered) break;
      await target.waitForTimeout(500);
    }
  }

  await snap(target,'package-input-missing-after-transient-retry');
  throw new Error('Maker Console package upload input did not appear after transient Try again recovery');
}

async function uploadPackageWithTransientRecovery(target) {
  let input = await waitForPackageInputWithTransientRecovery(target);
  try {
    await input.setInputFiles(join(KIT,packages[0]),{timeout:30000});
  } catch (error) {
    const recovered = await recoverMakerConsoleTransientError(target,'package file selection');
    if (!recovered) throw error;
    input = await waitForPackageInputWithTransientRecovery(target);
    await input.setInputFiles(join(KIT,packages[0]),{timeout:30000});
  }
}
`;

  source = replaceOnce(
    source,
    `async function click(target, re, timeout = 15000) {
  const button = target.getByRole('button',{name:re}).or(target.getByRole('link',{name:re})).first();
  await button.waitFor({state:'visible', timeout});
  const text = ((await button.textContent()) || '').trim();
  if (/^(submit|publish|submit for review)$/i.test(text)) throw new Error(\`guard refused \${text}\`);
  await button.click({timeout});
  await target.waitForTimeout(900);
}`,
    `async function click(target, re, timeout = 15000) {
  await recoverMakerConsoleTransientError(target,'button navigation');

  let button = target.getByRole('button',{name:re}).or(target.getByRole('link',{name:re})).first();
  try {
    await button.waitFor({state:'visible', timeout});
  } catch (error) {
    const recovered = await recoverMakerConsoleTransientError(target,'button navigation');
    if (!recovered) throw error;
    button = target.getByRole('button',{name:re}).or(target.getByRole('link',{name:re})).first();
    await button.waitFor({state:'visible', timeout});
  }

  const text = ((await button.textContent()) || '').trim();
  if (/^(submit|publish|submit for review)$/i.test(text)) throw new Error(\`guard refused \${text}\`);
  await button.click({timeout});
  await target.waitForTimeout(900);
}`,
    'click helper'
  );

  source = replaceOnce(
    source,
    `async function clickIfVisible(target, re) {
  const button = target.getByRole('button',{name:re}).or(target.getByRole('link',{name:re})).first();
  if (!await visible(button)) return false;
  const text = ((await button.textContent()) || '').trim();
  if (/^(submit|publish|submit for review)$/i.test(text)) return false;
  await button.click();
  await target.waitForTimeout(1100);
  return true;
}`,
    `async function clickIfVisible(target, re) {
  await recoverMakerConsoleTransientError(target,'optional button navigation');
  const button = target.getByRole('button',{name:re}).or(target.getByRole('link',{name:re})).first();
  if (!await visible(button)) return false;
  const text = ((await button.textContent()) || '').trim();
  if (/^(submit|publish|submit for review)$/i.test(text)) return false;
  await button.click();
  await target.waitForTimeout(1100);
  return true;
}
${helper}`,
    'clickIfVisible helper and transient recovery insertion'
  );

  source = replaceOnce(
    source,
    `        page = await livePage();
        const input = page.locator('input[type="file"]').first();
        await input.setInputFiles(join(KIT,packages[0]));
        await click(page,/^(next|continue)$/i,180000);`,
    `        page = await livePage();
        await uploadPackageWithTransientRecovery(page);
        await click(page,/^(next|continue)$/i,180000);`,
    'resumed package upload'
  );

  source = replaceOnce(
    source,
    `      page = await livePage();
      const input = page.locator('input[type="file"]').first();
      await input.setInputFiles(join(KIT,packages[0]));
      await click(page,/^(next|continue)$/i,180000);`,
    `      page = await livePage();
      await uploadPackageWithTransientRecovery(page);
      await click(page,/^(next|continue)$/i,180000);`,
    'fresh package upload'
  );

  return source;
}
