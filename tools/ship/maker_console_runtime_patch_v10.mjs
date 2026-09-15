import { patchMakerConsoleSource as patchBase } from './maker_console_runtime_patch_v9.mjs';

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Maker Console release-notes patch could not find ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Maker Console release-notes patch found ${label} more than once`);
  }
  return source.slice(0, first) + after + source.slice(first + before.length);
}

export function patchMakerConsoleSource(source, options) {
  source = patchBase(source, options);

  const before = [
    "function normalizeReleaseNotes(text) {",
    "  let value = String(text || '').replace(/\\r/g,'').trim();",
    "  value = value.replace(/^\\s*(initial release|initial version|first release)\\s*[:.\\-–—]*\\s*/i,'').trim();",
    "  if (!value) throw new Error('release notes are empty after normalization');",
    "",
    "  const rawLines = value.split('\\n').map(line => line.trim()).filter(Boolean);",
    "  let items = [];",
    "  const bulletLines = rawLines.filter(line => /^(?:[-*•]|\\d+[.)])\\s+/.test(line));",
    "  if (bulletLines.length) {",
    "    items = rawLines.map(line => line.replace(/^(?:[-*•]|\\d+[.)])\\s+/,'').trim()).filter(Boolean);",
    "  } else {",
    "    items = value.split(/(?<=[.!?])\\s+/).map(item => item.trim()).filter(Boolean);",
    "  }",
    "",
    "  items = items",
    "    .map(item => item.replace(/^\\s*(initial release|initial version|first release)\\s*[:.\\-–—]*\\s*/i,'').trim())",
    "    .filter(Boolean)",
    "    .slice(0,6);",
    "",
    "  if (!items.length) throw new Error('release notes have no user-visible bullet content');",
    "  return items.map(item => `• ${item}`).join('\\n');",
    "}"
  ].join('\n');

  const after = [
    "function normalizeReleaseNotes(text) {",
    "  let value = String(text || '').replace(/\\r/g,'').trim();",
    "  value = value.replace(/^\\s*(initial release|initial version|first release)\\s*[:.\\-–—]*\\s*/i,'').trim();",
    "  if (!value) throw new Error('release notes are empty after normalization');",
    "",
    "  const clean = item => String(item || '')",
    "    .replace(/^(?:[-*•]|\\d+[.)])\\s+/,'')",
    "    .replace(/^\\s*(initial release|initial version|first release)\\s*[:.\\-–—]*\\s*/i,'')",
    "    .trim();",
    "",
    "  const rawLines = value.split('\\n').map(clean).filter(Boolean);",
    "  const hasBullets = value.split('\\n').some(line => /^(?:\\s*[-*•]|\\s*\\d+[.)])\\s+/.test(line));",
    "  let items = hasBullets",
    "    ? rawLines",
    "    : value.split(/(?<=[.!?])\\s+/).map(clean).filter(Boolean);",
    "",
    "  // Older PackRat submissions sometimes used one giant comma-heavy release sentence.",
    "  // Turn that into scannable value bullets rather than a wall of text.",
    "  if (items.length === 1 && items[0].length > 180) {",
    "    const clauses = items[0]",
    "      .split(/\\s*;\\s*|,\\s+(?=[A-Za-z0-9])/)",
    "      .map(part => part.trim().replace(/^(?:and|plus)\\s+/i,''))",
    "      .filter(Boolean);",
    "",
    "    if (clauses.length >= 2) {",
    "      const targetCount = Math.min(4, Math.max(2, Math.ceil(clauses.length / 3)));",
    "      const groups = Array.from({length:targetCount}, () => []);",
    "      const targetChars = Math.ceil(clauses.join(', ').length / targetCount);",
    "      let groupIndex = 0;",
    "      let chars = 0;",
    "      for (const clause of clauses) {",
    "        if (groupIndex < targetCount - 1 && groups[groupIndex].length && chars + clause.length > targetChars) {",
    "          groupIndex += 1;",
    "          chars = 0;",
    "        }",
    "        groups[groupIndex].push(clause);",
    "        chars += clause.length + 2;",
    "      }",
    "      items = groups.filter(group => group.length).map(group => group.join(', '));",
    "    }",
    "  }",
    "",
    "  // Release notes are a second sales/value surface, not a changelog dump.",
    "  // Preserve every authored point, but rebalance long lists down to four bullets.",
    "  while (items.length > 4) {",
    "    let bestIndex = 0;",
    "    let bestLength = Number.POSITIVE_INFINITY;",
    "    for (let i = 0; i < items.length - 1; i++) {",
    "      const combined = items[i].length + items[i + 1].length;",
    "      if (combined < bestLength) {",
    "        bestLength = combined;",
    "        bestIndex = i;",
    "      }",
    "    }",
    "    items.splice(bestIndex, 2, items[bestIndex] + '; ' + items[bestIndex + 1]);",
    "  }",
    "",
    "  items = items.map(clean).filter(Boolean);",
    "  if (!items.length) throw new Error('release notes have no user-visible bullet content');",
    "",
    "  const normalized = items.map(item => {",
    "    const first = item.charAt(0);",
    "    const body = first ? first.toUpperCase() + item.slice(1) : item;",
    "    return '• ' + body;",
    "  }).join('\\n');",
    "",
    "  console.log('Release notes: ' + items.length + ' value bullet' + (items.length === 1 ? '' : 's'));",
    "  return normalized;",
    "}"
  ].join('\n');

  source = replaceOnce(source, before, after, 'release notes normalizer');
  return source;
}
