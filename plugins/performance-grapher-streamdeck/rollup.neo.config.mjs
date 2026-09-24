import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";

// The Neo-only product imports mature telemetry/Infobar logic from this source tree.
export default {
  input: "../performance-grapher-neo/src/plugin.js",
  output: {
    file: "../performance-grapher-neo/com.packrat.performance-grapher-neo.sdPlugin/bin/plugin.js",
    format: "es",
    sourcemap: false,
  },
  plugins: [
    nodeResolve({ browser: false, exportConditions: ["node"], preferBuiltins: true }),
    commonjs(),
    terser(),
  ],
};
