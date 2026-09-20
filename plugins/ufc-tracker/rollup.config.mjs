import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";
import path from "node:path";
import url from "node:url";

const isWatching = !!process.env.ROLLUP_WATCH;
const sdPlugin = "com.packrat.ufc-tracker.sdPlugin";

/**
 * Pulls in plugins/_shared/src (the ESPN client, poller, actions and key renderer that every
 * Packrat sport tracker uses) by relative import and bundles it into the single plugin.js. No
 * native code anywhere: data comes from fetch and key faces are SVG strings, so the same bundle
 * runs on Windows and macOS.
 *
 * @type {import('rollup').RollupOptions}
 */
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
			buildStart: function () {
				this.addWatchFile(`${sdPlugin}/manifest.json`);
			}
		},
		typescript({
			mapRoot: isWatching ? "./" : undefined,
			// The plugin only transforms files under its own root by default, which would leave
			// the shared module's TypeScript for Rollup's JavaScript parser to choke on.
			include: ["src/**/*.ts", "../_shared/src/**/*.ts"]
		}),
		nodeResolve({
			browser: false,
			exportConditions: ["node"],
			preferBuiltins: true,
			// The shared tracker core is imported as source from ../_shared/src, so resolution
			// has to know about .ts; the default extensions stop at .js.
			extensions: [".ts", ".mjs", ".js", ".json", ".node"],
			// Load bearing. ../_shared has its own node_modules for its tests, so without dedupe
			// the shared files resolve the SDK to that copy and the bundle ends up with two
			// instances: two Connection singletons, one of which is never registered. The
			// symptom is nasty, every settings call from shared code hangs forever with no error.
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
