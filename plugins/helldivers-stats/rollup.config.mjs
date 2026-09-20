import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import path from "node:path";
import url from "node:url";

const isWatching = !!process.env.ROLLUP_WATCH;
const sdPlugin = "com.packrat.helldivers-stats.sdPlugin";

/** @type {import('rollup').RollupOptions} */
const config = {
	input: "src/plugin.ts",
	output: {
		dir: `${sdPlugin}/bin`,
		entryFileNames: "plugin.js",
		format: "es",
		sourcemap: isWatching,
		sourcemapPathTransform: (relativeSourcePath, sourcemapPath) => {
			return url.pathToFileURL(path.resolve(path.dirname(sourcemapPath), relativeSourcePath)).href;
		}
	},
	plugins: [
		{
			name: "watch-externals",
			buildStart() {
				this.addWatchFile(`${sdPlugin}/manifest.json`);
			}
		},
		typescript({
			mapRoot: isWatching ? "./" : undefined,
			// Load bearing: shared TypeScript source must be transformed into this bundle.
			include: ["src/**/*.ts", "../_shared/src/**/*.ts"]
		}),
		nodeResolve({
			browser: false,
			exportConditions: ["node"],
			preferBuiltins: true,
			extensions: [".ts", ".mjs", ".js", ".json", ".node"],
			// Load bearing: one SDK instance keeps shared settings calls on the registered connection.
			dedupe: ["@elgato/streamdeck", "@elgato/utils", "ws"]
		}),
		commonjs(),
		!isWatching && terser(),
		{
			name: "emit-module-package-file",
			generateBundle() {
				this.emitFile({ fileName: "package.json", source: `{ "type": "module" }`, type: "asset" });
			}
		}
	]
};

export default config;

