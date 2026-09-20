import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import { execSync } from "child_process";
import { cpSync } from "fs";

const sdPlugin = process.env.SD_PLUGIN_DIR ?? "com.ratpack.kick.sdPlugin";
const PLUGIN_UUID = "com.ratpack.kick";
const isWatch = process.env.ROLLUP_WATCH === "true";

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
		{
			name: "emit-module-package-file",
			generateBundle() {
				this.emitFile({ fileName: "package.json", source: `{"type":"module"}`, type: "asset" });
			},
		},
		isWatch && {
			name: "dev-reload",
			writeBundle() {
				try { cpSync("src/ui/stats.html", `${sdPlugin}/ui/stats.html`); } catch { /**/ }
				try {
					execSync(`npx streamdeck restart ${PLUGIN_UUID}`, { stdio: "ignore" });
					console.log(`[dev] reloaded ${PLUGIN_UUID}`);
				} catch { /**/ }
			},
		},
	].filter(Boolean),
};
