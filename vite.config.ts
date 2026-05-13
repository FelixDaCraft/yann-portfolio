import { defineConfig } from "vite";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";

export default defineConfig({
  plugins: [vanillaExtractPlugin()],
  server: {
    host: true,
    port: 4321,
    strictPort: false,
  },
  preview: {
    host: true,
    port: 4321,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    cssCodeSplit: false,
    target: "es2022",
    rollupOptions: {
      output: {
        assetFileNames: "assets/[name]-[hash][extname]",
        chunkFileNames: "assets/[name]-[hash].js",
        entryFileNames: "assets/[name]-[hash].js",
      },
    },
  },
});
