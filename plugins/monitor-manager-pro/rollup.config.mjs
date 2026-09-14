import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";

const isWatching=Boolean(process.env.ROLLUP_WATCH);
const sdPlugin="com.packrat.monitormanagerpro.sdPlugin";
const outputDir=`${sdPlugin}/bin`;

export default {
  input:"src/plugin.ts",
  output:{dir:outputDir,entryFileNames:"plugin.js",format:"es",sourcemap:isWatching},
  plugins:[
    typescript({
      tsconfig:"./tsconfig.json",
      include:["src/**/*.ts","../monitor-manager-lite/src/runtime.ts","../_shared/monitor-manager/**/*.ts","../_shared/monitor-manager/**/*.mjs"],
      compilerOptions:{outDir:`${outputDir}/.typescript`}
    }),
    nodeResolve({browser:false,exportConditions:["node"],preferBuiltins:true,extensions:[".ts",".js",".mjs",".json"],dedupe:["@elgato/streamdeck","@elgato/utils","ws"]}),
    commonjs(),
    !isWatching&&terser(),
    {name:"emit-module-package-file",generateBundle(){this.emitFile({fileName:"package.json",source:"{ \"type\": \"module\" }",type:"asset"});}}
  ]
};
