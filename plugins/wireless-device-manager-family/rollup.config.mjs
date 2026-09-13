import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";

const watching = Boolean(process.env.ROLLUP_WATCH);

function config(input, uuid) {
  const outputDir = `${uuid}.sdPlugin/bin`;
  return {
    input,
    output: { dir: outputDir, entryFileNames: "plugin.js", format: "es", sourcemap: watching },
    plugins: [
      typescript({
        tsconfig: "./tsconfig.json",
        include: ["src/**/*.ts", "src/**/*.js"],
        compilerOptions: { outDir: `${outputDir}/.typescript` }
      }),
      nodeResolve({
        browser: false,
        exportConditions: ["node"],
        preferBuiltins: true,
        extensions: [".ts", ".js", ".mjs", ".json"],
        dedupe: ["@elgato/streamdeck", "@elgato/utils", "ws"]
      }),
      commonjs(),
      !watching && terser(),
      {
        name: "emit-module-package-file",
        generateBundle() {
          this.emitFile({ fileName: "package.json", source: "{ \"type\": \"module\" }", type: "asset" });
        }
      }
    ]
  };
}

export default [
  config("src/lite.ts", "com.packrat.wireless-device-manager"),
  config("src/pro.ts", "com.packrat.wireless-device-manager-pro")
];
