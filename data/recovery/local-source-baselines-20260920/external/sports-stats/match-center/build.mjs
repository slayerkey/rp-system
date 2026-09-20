import * as esbuild from "esbuild";
import { writeFileSync, mkdirSync, existsSync, cpSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const isWatch = process.argv.includes("--watch");

const outDir = "com.matchcenter.streamdeck.sdPlugin/bin";

mkdirSync(outDir, { recursive: true });

const buildOptions = {
  entryPoints: ["src/plugin.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",          // SDK is ESM-only, must output ESM
  outfile: `${outDir}/plugin.js`,
  external: ["@napi-rs/canvas", "@napi-rs/canvas-win32-x64-msvc"],
  logLevel: "info",
  sourcemap: false,
  // CJS deps (ws, etc.) call require() for Node built-ins; inject require into ESM scope
  banner: {
    js: `import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);`,
  },
};

function copyNativeModules() {
  const napiSrc = resolve(__dirname, "node_modules/@napi-rs");
  const napiDest = resolve(__dirname, `${outDir}/node_modules/@napi-rs`);
  mkdirSync(napiDest, { recursive: true });

  // Copy the JS wrapper package
  const canvasSrc = resolve(napiSrc, "canvas");
  const canvasDest = resolve(napiDest, "canvas");
  if (existsSync(canvasSrc)) {
    cpSync(canvasSrc, canvasDest, { recursive: true });
    console.log("✓ Copied @napi-rs/canvas");
  }

  // Copy the native binary package (Windows x64)
  // Skip if already present -- the .node file is locked when plugin is running
  const binarySrc = resolve(napiSrc, "canvas-win32-x64-msvc");
  const binaryDest = resolve(napiDest, "canvas-win32-x64-msvc");
  if (!existsSync(binaryDest)) {
    if (existsSync(binarySrc)) {
      cpSync(binarySrc, binaryDest, { recursive: true });
      console.log("✓ Copied @napi-rs/canvas-win32-x64-msvc (native binary)");
    } else {
      console.warn("⚠ Native canvas binary not found -- image rendering will fall back to text");
    }
  } else {
    console.log("✓ @napi-rs/canvas-win32-x64-msvc already present");
  }

  // Write package.json in bin/ so Node treats .js as ESM
  writeFileSync(
    resolve(__dirname, `${outDir}/package.json`),
    JSON.stringify({ type: "module" }, null, 2)
  );
  console.log("✓ Wrote bin/package.json (type: module)");
}

if (isWatch) {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
  console.log("Watching...");
} else {
  await esbuild.build(buildOptions);
  copyNativeModules();
  console.log("✓ Build complete");
}
