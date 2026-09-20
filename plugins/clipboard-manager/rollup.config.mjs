import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const isWatching = !!process.env.ROLLUP_WATCH;
const sdPlugin = "com.packrat.clipboard.sdPlugin";

// One shipped artifact runs on both OSes, so all three native binaries travel together --
// koffi picks the matching one at runtime via process.platform/process.arch. npm only
// auto-installs the optional dep matching the host machine, so on a Windows dev box the mac
// ones need an explicit
// `npm install --force @koromix/koffi-darwin-x64@<version> @koromix/koffi-darwin-arm64@<version>`
// (matching the koffi version in package.json) before they show up in node_modules.
const KOFFI_PLATFORM_PACKAGES = [
	{ pkg: "@koromix/koffi-win32-x64", binary: "win32_x64/koffi.node" },
	{ pkg: "@koromix/koffi-darwin-x64", binary: "darwin_x64/koffi.node" },
	{ pkg: "@koromix/koffi-darwin-arm64", binary: "darwin_arm64/koffi.node" }
];

/**
 * koffi has to sit in the .sdPlugin folder as real files: it resolves its own native
 * binary at runtime via createRequire, so bundling it would skip wrapNative() and
 * leave an export with no struct/union/func on it.
 *
 * Copies are skipped when the destination already matches, because a running plugin
 * holds koffi.node open and Windows fails the unlink with EPERM -- which would make
 * every rebuild-while-linked fail.
 */
function copyKoffi() {
	const pairs = [
		{ src: "node_modules/koffi", dest: `${sdPlugin}/node_modules/koffi`, probe: "package.json" },
		...KOFFI_PLATFORM_PACKAGES.map(({ pkg, binary }) => ({
			src: `node_modules/${pkg}`,
			dest: `${sdPlugin}/node_modules/${pkg}`,
			probe: binary
		}))
	];

	// Build-time leftovers with no runtime use. koffi.lib is a linker import library
	// (win32 only); shipping it is just noise in someone else's plugins folder.
	const prune = ["node_modules/@koromix/koffi-win32-x64/win32_x64/koffi.lib", "node_modules/koffi/index.d.ts"];

	return {
		name: "copy-koffi",
		writeBundle() {
			for (const { src, dest, probe } of pairs) {
				if (isUpToDate(src, dest, probe)) continue;
				try {
					fs.rmSync(dest, { recursive: true, force: true });
					fs.cpSync(src, dest, { recursive: true });
				} catch (error) {
					if (error.code === "EPERM" || error.code === "EBUSY") {
						this.warn(
							`Could not refresh ${dest} -- the plugin is running and holding it open. ` +
								`Existing copy left in place. Run 'streamdeck stop com.packrat.clipboard' first if koffi changed.`
						);
						continue;
					}
					throw error;
				}
			}

			for (const rel of prune) {
				fs.rmSync(path.join(sdPlugin, rel), { force: true });
			}
		}
	};
}

/** Cheap staleness check: the native binary's (or package.json's) size and mtime are enough. */
function isUpToDate(src, dest, probe) {
	try {
		const a = fs.statSync(path.join(src, probe));
		const b = fs.statSync(path.join(dest, probe));
		return a.size === b.size && Math.abs(a.mtimeMs - b.mtimeMs) < 1000;
	} catch {
		return false;
	}
}

/**
 * @type {import('rollup').RollupOptions}
 */
const config = {
	input: "src/plugin.ts",
	// koffi resolves its own native binary at runtime via createRequire. Bundling it
	// would skip wrapNative(), which is what attaches struct/union/func to the export.
	external: [/^koffi$/, /^@koromix\//],
	output: {
		// src/paste/input.ts and src/clipboard/clipboard.ts each dynamically import whichever
		// platform module matches process.platform, so the other one's module-scope native
		// library load (user32.dll on Windows, CoreGraphics on macOS) never runs on the wrong
		// OS. That only holds if each platform module stays a SEPARATE chunk whose body is
		// evaluated lazily at the import() call site. inlineDynamicImports would flatten them
		// into the entry and evaluate them eagerly at startup, which crashes the plugin on
		// load. So emit a dir with real chunks; the entry stays bin/plugin.js per the manifest.
		dir: `${sdPlugin}/bin`,
		entryFileNames: "plugin.js",
		chunkFileNames: "[name].js",
		format: "es",
		sourcemap: isWatching,
		sourcemapPathTransform: (relativeSourcePath, sourcemapPath) => {
			return url.pathToFileURL(path.resolve(path.dirname(sourcemapPath), relativeSourcePath)).href;
		}
	},
	plugins: [
		{
			name: "watch-externals",
			buildStart: function () {
				this.addWatchFile(`${sdPlugin}/manifest.json`);
			}
		},
		{
			// npm silently skips optional deps whose os/cpu don't match, which would
			// otherwise produce a plugin that builds fine and dies on load -- on this OS
			// for win32-x64, or silently for whichever mac binary wasn't fetched, since
			// this one artifact ships to both platforms.
			name: "assert-koffi-binary",
			buildStart() {
				for (const { pkg, binary } of KOFFI_PLATFORM_PACKAGES) {
					const file = `node_modules/${pkg}/${binary}`;
					if (!fs.existsSync(file)) {
						this.error(
							`Missing ${file}. koffi's prebuilt binaries are optional dependencies gated by ` +
								`os/cpu, so npm only auto-installs the one matching this machine. Run ` +
								`'npm install --force ${pkg}@<koffi version in package.json>' to fetch the rest.`
						);
					}
				}
			}
		},
		typescript({
			mapRoot: isWatching ? "./" : undefined
		}),
		nodeResolve({
			browser: false,
			exportConditions: ["node"],
			preferBuiltins: true
		}),
		commonjs(),
		!isWatching && terser(),
		{
			name: "emit-module-package-file",
			generateBundle() {
				this.emitFile({ fileName: "package.json", source: `{ "type": "module" }`, type: "asset" });
			}
		},
		copyKoffi()
	]
};

export default config;
