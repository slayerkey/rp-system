import { patchMakerConsoleSource as patchBase } from './maker_console_runtime_patch_v8.mjs';

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Maker Console no-resume media patch could not find ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Maker Console no-resume media patch found ${label} more than once`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

export function patchMakerConsoleSource(source, options) {
  source = patchBase(source, options);

  source = replaceOnce(
    source,
`  } else {
    const icon = await chooseFileInput(target,'icon');
    if (icon) {
      await icon.locator.setInputFiles(join(KIT,'01_search_icon.png'),{timeout:60000});
      used.add(icon.index);
      console.log('Search/app icon: dedicated labeled field');
    } else {
      console.log('Search/app icon: no dedicated Maker Console field; skipping standalone icon upload');
    }
  }`,
`  } else {
    let icon = await chooseFileInput(target,'icon');

    if (!icon) {
      const current = await describeFileInputs(target);
      const inputs = target.locator('input[type="file"]');
      const orderedSingles = current.filter(info => {
        const accept = String(info.accept || '').toLowerCase();
        const context = (String(info.id || '') + ' ' + String(info.name || '') + ' ' + String(info.context || '')).toLowerCase();
        const image = /image|png|jpe?g|webp/.test(accept);
        const forbidden = /streamdeckplugin|icuewidget|gallery|additional media|screenshots|mp4|video/.test(context + ' ' + accept);
        return image && !info.multiple && !forbidden;
      });

      // Maker Console presents App Icon immediately above Thumbnail. If both
      // unlabeled single-image inputs exist, DOM order gives us a deterministic
      // icon/thumbnail split without borrowing the thumbnail input.
      if (orderedSingles.length >= 2) {
        icon = {
          locator:inputs.nth(orderedSingles[0].index),
          index:orderedSingles[0].index,
          info:{...orderedSingles[0],method:'ordered-single-image-icon'}
        };
      }
    }

    if (icon) {
      await icon.locator.setInputFiles(join(KIT,'01_search_icon.png'),{timeout:60000});
      used.add(icon.index);
      console.log('Search/app icon: ' + (icon.info?.method || 'dedicated labeled field'));
    } else {
      const uploaded = await uploadThroughNamedMediaSection(
        target,
        /^(App Icon|Search Icon)$/i,
        join(KIT,'01_search_icon.png'),
        /^Thumbnail$/i
      );
      if (uploaded) {
        console.log('Search/app icon: visible App Icon section');
      } else {
        console.log('Search/app icon: no safe upload target found; required-field validation will stop before submit');
      }
    }
  }`,
    'app icon routing fallback'
  );

  source = replaceOnce(
    source,
    "      return image && !info.multiple && !forbidden;\n    });\n    if (fallback.length === 1) {",
    "      return image && !info.multiple && !forbidden && !used.has(info.index);\n    });\n    if (fallback.length === 1) {",
    'thumbnail fallback excludes selected icon input'
  );

  return source;
}
