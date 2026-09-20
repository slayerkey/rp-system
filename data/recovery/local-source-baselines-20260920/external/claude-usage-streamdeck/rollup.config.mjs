import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";

const sdPlugin = process.env.SD_PLUGIN_DIR ?? "com.ratpack.claude-usage.sdPlugin";

/** @type {import('rollup').RollupOptions} */
export default {
	input: "src/plugin.ts",
	output: {
		file: `${sdPlugin}/bin/plugin.js`,
		format: "es",
		sourcemap: true,
	},
	plugins: [
		typescript({ tsconfig: "./tsconfig.json" }),
		nodeResolve({ browser: false, exportConditions: ["node"], preferBuiltins: true }),
		commonjs(),
		// Stream Deck runs bin/plugin.js with Node; mark it as an ES module.
		{
			name: "emit-module-package-file",
			generateBundle() {
				this.emitFile({ fileName: "package.json", source: `{"type":"module"}`, type: "asset" });
			},
		},
	],
};
