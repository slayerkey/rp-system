import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";

export default {
  input: "src/plugin.js",
  output: { file: "com.packrat.macro-recorder-pro.sdPlugin/bin/plugin.js", format: "es", sourcemap: false },
  plugins: [
    nodeResolve({ browser:false, exportConditions:["node"], preferBuiltins:true }),
    commonjs(),
    terser(),
  ],
};
