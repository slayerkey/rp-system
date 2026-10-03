import { chromium } from 'playwright';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Default: render the actual SVG document via Chromium screenshot. When a
// Windows graphics/session problem prevents Page.captureScreenshot, use the
// same Chromium SVG image renderer via a 2D canvas instead of failing Rat Art.
// Batch mode reuses one Chromium session for every source key face.
const args = process.argv.slice(2);
const batch = args.includes('--batch');
const canvasOnly = args.includes('--canvas-only');
const positional = args.filter(arg => arg !== '--batch' && arg !== '--canvas-only');
if (positional.length !== 2) {
  throw new Error('usage: node render_svg_icon.mjs [--batch] <src.svg|svg-dir> <out.png|png-dir> [--canvas-only]');
}
const [srcArg, outArg] = positional;
const sources = batch
  ? readdirSync(resolve(srcArg)).filter(name => extname(name).toLowerCase() === '.svg').sort().map(name => ({
      source: resolve(srcArg, name),
      output: resolve(outArg, name.slice(0, -4) + '.png'),
    }))
  : [{ source: resolve(srcArg), output: resolve(outArg) }];
if (!sources.length) throw new Error('SVG batch has no .svg source files');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 288, height: 288 }, deviceScaleFactor: 1 });
  for (const { source, output } of sources) {
    mkdirSync(dirname(output), { recursive: true });
    await page.goto(pathToFileURL(source).href, { waitUntil: 'load' });
    await page.evaluate(() => {
      const svg = document.documentElement;
      if (!svg || svg.tagName.toLowerCase() !== 'svg') throw new Error('source document root is not SVG');
      svg.setAttribute('width', '288');
      svg.setAttribute('height', '288');
      svg.setAttribute('preserveAspectRatio', svg.getAttribute('preserveAspectRatio') || 'xMidYMid meet');
      svg.style.width = '288px';
      svg.style.height = '288px';
      svg.style.display = 'block';
      svg.style.background = 'transparent';
      svg.style.margin = '0';
      svg.style.padding = '0';
    });

    let usedCanvas = canvasOnly;
    if (!canvasOnly) {
      try {
        await page.screenshot({ path: output, omitBackground: true, timeout: 15000 });
      } catch (error) {
        // Chromium's screenshot protocol can fail in real Windows desktop
        // sessions even when the SVG was successfully laid out and painted.
        usedCanvas = true;
        console.warn('ICON SCREENSHOT FALLBACK: ' + String(error?.message || error));
      }
    }
    if (usedCanvas) {
      // The SVG file is an XML document: HTMLCanvasElement cannot be created there.
      // Capture its exact rendered markup, then rasterize in an HTML document.
      const svgMarkup = await page.evaluate(() => new XMLSerializer().serializeToString(document.documentElement));
      await page.goto('about:blank');
      const base64 = await page.evaluate(async markup => {
        const blobUrl = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }));
        try {
          const image = new Image();
          await new Promise((ok, fail) => {
            image.onload = ok;
            image.onerror = () => fail(new Error('Canvas could not decode the SVG'));
            image.src = blobUrl;
          });
          const canvas = document.createElement('canvas');
          canvas.width = 288;
          canvas.height = 288;
          const ctx = canvas.getContext('2d', { alpha: true });
          if (!ctx) throw new Error('2D canvas renderer is not available');
          ctx.clearRect(0, 0, 288, 288);
          ctx.drawImage(image, 0, 0, 288, 288);
          const data = canvas.toDataURL('image/png');
          if (!data.startsWith('data:image/png;base64,')) throw new Error('Canvas returned a non-PNG image');
          return data.slice('data:image/png;base64,'.length);
        } finally {
          URL.revokeObjectURL(blobUrl);
        }
      }, svgMarkup);
      const bytes = Buffer.from(base64, 'base64');
      if (bytes.length < 100 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
        throw new Error('Canvas PNG rasterization failed its output integrity check');
      }
      writeFileSync(output, bytes);
    }
    console.log('ICON PASS' + (usedCanvas ? ' (canvas)' : '') + ': ' + output);
  }
} finally {
  await browser.close();
}
