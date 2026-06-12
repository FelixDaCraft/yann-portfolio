import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";

// Dev only : /admin → /admin.html (en prod c'est nginx qui fait le rewrite).
const adminRewrite = (): Plugin => ({
  name: "admin-rewrite",
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      if (req.url === "/admin" || req.url?.startsWith("/admin/") || req.url?.startsWith("/admin?")) {
        req.url = "/admin.html";
      }
      next();
    });
  },
});

export default defineConfig({
  plugins: [vanillaExtractPlugin(), adminRewrite()],
  server: {
    host: true,
    port: 4321,
    strictPort: false,
    // Dev : l'API yann-api tourne en local (cd api && npm run dev)
    proxy: {
      "/api": "http://localhost:3000",
    },
  },
  preview: {
    host: true,
    port: 4321,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    // cssCodeSplit par défaut (true) : chaque entrée (index / admin) embarque
    // uniquement son CSS — l'index garde un seul fichier CSS comme avant.
    target: "es2022",
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, "index.html"),
        admin: resolve(import.meta.dirname, "admin.html"),
      },
      output: {
        assetFileNames: "assets/[name]-[hash][extname]",
        chunkFileNames: "assets/[name]-[hash].js",
        entryFileNames: "assets/[name]-[hash].js",
      },
    },
  },
});
