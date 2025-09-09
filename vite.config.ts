import { resolve } from "path";
import { copyFileSync } from "node:fs";
import { defineConfig, configDefaults } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import dts from "vite-plugin-dts";

export default defineConfig({
  ssr : {
    external : ["fs","path" ,"os"],
  },
  plugins: [
    tsconfigPaths(),
    dts({
      rollupTypes: true,
      afterBuild: () => {
        // Compatibility for tools like publint
        copyFileSync("dist/index.d.ts", "dist/index.d.cts");
      },
    }),
   
  ],

  resolve: {
    alias: {
      "@/*": `${resolve(__dirname, "src/*")}/`,
    },
  },

  build: {
    target: "node18",
    minify: false,
    outDir: resolve(__dirname, "dist"),
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "mdocxengine",
      formats: ["es", "cjs",],
      fileName: (format) => {
        switch (format) {
          case "iife": return "index.iife.js";
          case "es": return "index.mjs";
          case "cjs": return "index.cjs";
          case "umd": return "index.umd.cjs";
          default: return "unknown";
        }
      },
    },
    commonjsOptions: {
      include: [/node_modules/],
    },
    rollupOptions : {
      external: ['fs', 'path', 'os', 'zlib', 'process'],
    }
  },

  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      thresholds: {
        statements: 100,
        branches: 99.68,
        functions: 100,
        lines: 100,
      },
      exclude: [
        ...configDefaults.exclude,
        "**/dist/**",
        "**/demo/**",
        "**/docs/**",
        "**/scripts/**",
        "**/src/**/index.ts",
        "**/src/**/types.ts",
        "**/*.spec.ts",
      ],
    },
    include: ["**/src/**/*.spec.ts", "**/tests/**/*.spec.ts"],
    exclude: [
      ...configDefaults.exclude,
      "**/build/**",
      "**/demo/**",
      "**/docs/**",
      "**/scripts/**",
    ],
  },
});
