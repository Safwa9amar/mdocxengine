import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import typescript from 'rollup-plugin-typescript2';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import alias from '@rollup/plugin-alias';
import dts from 'rollup-plugin-dts';
import {terser} from "rollup-plugin-terser"
// ESM alternative to __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pkg = JSON.parse(fs.readFileSync(path.resolve('./package.json'), 'utf-8'));


import { builtinModules } from 'module';
import replace from '@rollup/plugin-replace';



const extensions = ['.js', '.ts', '.json'];

// map @ -> src
const aliasEntries = [
  { find: '@', replacement: path.resolve(__dirname, 'src') }
];

// mark dependencies and node builtins as external
const external = [
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
  ...builtinModules
];

export default [
  // 1) JS bundles (CJS + ESM)
  {
    input: 'src/index.ts',
    external,
    plugins: [
      alias({ entries: aliasEntries }),
      resolve({ extensions }),
      commonjs(),
      typescript({
        useTsconfigDeclarationDir: true,      // write .d.ts to declarationDir
        clean: true,
        tsconfig: './tsconfig.json'
      }),
      // terser(), // optional minify for ESM/CJS if you want
    ],
    output: [
      { file: pkg.main, format: 'cjs', sourcemap: true },
      { file: pkg.module, format: 'es', sourcemap: true }
    ],
  },

  // 2) Bundle .d.ts into single file
  {
    // input should point to the generated declaration entry
    // rollup-plugin-typescript2 will have emitted to dist/types. Usually root is dist/types/index.d.ts
    input: 'dist/types/index.d.ts',
    
    output: [{ file: pkg.types, format: 'es' }],
    plugins: [
  
      dts(),
    ],
  }
];
