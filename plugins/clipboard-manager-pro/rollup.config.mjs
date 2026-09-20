import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const isWatching = !!process.env.ROLLUP_WATCH;
const sdPlugin = "com.packrat.clipboardpro.sdPlugin";
const KOFFI_PLATFORM_PACKAGES = [
	{ pkg: "@koromix/koffi-win32-x64", binary: "win32_x64/koffi.node" },
	{ pkg: "@koromix/koffi-darwin-x64", binary: "darwin_x64/koffi.node" },
	{ pkg: "@koromix/koffi-darwin-arm64", binary: "darwin_arm64/koffi.node" }
];

function isUpToDate(src, dest, probe) {
	try {
		const a = fs.statSync(path.join(src, probe));
		const b = fs.statSync(path.join(dest, probe));
		return a.size === b.size && Math.abs(a.mtimeMs - b.mtimeMs) < 1000;
	} catch {
		return false;
	}
}

function copyKoffi() {
	const pairs = [
		{ src: "node_modules/koffi", dest: `${sdPlugin}/node_modules/koffi`, probe: "package.json" },
		...KOFFI_PLATFORM_PACKAGES.map(({ pkg, binary }) => ({
			src: `node_modules/${pkg}`,
			dest: `${sdPlugin}/node_modules/${pkg}`,
			probe: binary
		}))
	];
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
						this.warn(`Could not refresh ${dest}. Stop com.packrat.clipboardpro and rebuild if koffi changed.`);
						continue;
					}
					throw error;
				}
			}
			for (const rel of prune) fs.rmSync(path.join(sdPlugin, rel), { force: true });
		}
	};
}

const config = {
	input: "src/plugin.ts",
	external: [/^koffi$/, /^@koromix\//],
	output: {
		dir: `${sdPlugin}/bin`,
		entryFileNames: "plugin.js",
		chunkFileNames: "[name].js",
		format: "es",
		sourcemap: isWatching,
		sourcemapPathTransform: (relativeSourcePath, sourcemapPath) =>
			url.pathToFileURL(path.resolve(path.dirname(sourcemapPath), relativeSourcePath)).href
	},
	plugins: [
		{
			name: "watch-externals",
			buildStart() {
				this.addWatchFile(`${sdPlugin}/manifest.json`);
			}
		},
		{
			name: "assert-koffi-binary",
			buildStart() {
				const coreVersion = JSON.parse(fs.readFileSync("node_modules/koffi/package.json", "utf8")).version;
				for (const { pkg, binary } of KOFFI_PLATFORM_PACKAGES) {
					const file = `node_modules/${pkg}/${binary}`;
					if (!fs.existsSync(file)) this.error(`Missing ${file}. Run npm install --force ${pkg}@${coreVersion}.`);
					const pkgVersion = JSON.parse(fs.readFileSync(`node_modules/${pkg}/package.json`, "utf8")).version;
					if (pkgVersion !== coreVersion) this.error(`${pkg}@${pkgVersion} does not match koffi core@${coreVersion}.`);
				}
			}
		},
		typescript({
			mapRoot: isWatching ? "./" : undefined,
			include: ["src/**/*.ts", "../clipboard-manager/src/**/*.ts"]
		}),
		nodeResolve({
			browser: false,
			exportConditions: ["node"],
			preferBuiltins: true,
			dedupe: ["@elgato/streamdeck", "@elgato/utils", "ws"]
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
