import { patchMakerConsoleSource as patchBase } from './maker_console_runtime_patch_v5.mjs';

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Maker Console recovery patch could not find ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Maker Console recovery patch found ${label} more than once`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

export function patchMakerConsoleSource(source, options) {
  source = patchBase(source, options);

  // The create wizard keeps one URL across several slides. Reloading /create/* can
  // silently return to package upload, so it is never a verified direct-resume URL.
  // Reopen the actual Draft from Products instead and let the editor identify its step.
  source = replaceOnce(
    source,
    "  if (RESUME && state.lastUrl && /^https:\\/\\/maker\\.elgato\\.com\\//i.test(state.lastUrl)) {",
    "  if (RESUME && state.lastUrl && /^https:\\/\\/maker\\.elgato\\.com\\//i.test(state.lastUrl) && !/^https:\\/\\/maker\\.elgato\\.com\\/(?:[^\\/?#]+\\/)?create(?:\\/|[?#]|$)/i.test(state.lastUrl)) {",
    'unsafe create-wizard direct resume guard'
  );

  // Maker Console multi-select buttons concatenate chip text without commas
  // (for example "ProductivityUtilities"). Verify each requested category by
  // normalized containment instead of assuming comma-delimited textContent.
  source = replaceOnce(
    source,
    "  if (label === 'Category') {\n    return normalized.split(',').map(value => value.trim()).filter(Boolean).includes(wanted);\n  }",
    "  if (label === 'Category') {\n    const compact = normalized.replace(/[^a-z0-9]+/g,'');\n    const compactWanted = wanted.replace(/[^a-z0-9]+/g,'');\n    return compactWanted.length > 0 && compact.includes(compactWanted);\n  }",
    'category chip verification'
  );

  // A package-upload slide also contains input[type=file]. Do not classify that
  // as Marketplace media. Only image/video-like file inputs or explicit media copy
  // qualify. This prevents an .icuewidget/.streamDeckPlugin input from being used
  // as a supposed cover upload after a retry.
  source = replaceOnce(
    source,
    `async function editorLooksLikeMedia(target) {
  if (await target.locator('input[type="file"]').count()) return true;
  const body = ((await target.locator('body').innerText().catch(() => '')) || '').toLowerCase();
  return body.includes('thumbnail') || body.includes('gallery') || body.includes('cover image');
}`,
    `async function editorLooksLikeMedia(target) {
  const inputs = await describeFileInputs(target);
  const hasMediaInput = inputs.some(info => {
    const accept = String(info.accept || '').toLowerCase();
    const haystack = (String(info.id || '') + ' ' + String(info.name || '') + ' ' + String(info.context || '')).toLowerCase();
    return /image|png|jpe?g|webp|mp4|video/.test(accept) || /media-app-icon|app icon|search icon|cover|thumbnail|gallery|additional media|screenshots/.test(haystack);
  });
  if (hasMediaInput) return true;

  const body = ((await target.locator('body').innerText().catch(() => '')) || '').toLowerCase();
  if (/upload your icue widget|only \.icuewidget files|upload your stream deck plugin|only \.streamdeckplugin files/.test(body)) return false;
  return body.includes('thumbnail') || body.includes('gallery') || body.includes('cover image') || body.includes('additional media');
}`,
    'media-step file input discriminator'
  );

  return source;
}
