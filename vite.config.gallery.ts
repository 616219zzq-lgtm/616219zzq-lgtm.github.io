import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  base: "./",
  publicDir: false,
  build: {
    outDir: "public",
    emptyOutDir: false,
    rollupOptions: { output: { entryFileNames: "assets/[name].js", assetFileNames: "assets/[name][extname]", chunkFileNames: "assets/shared-[hash].js" }, input: { gallery: resolve(__dirname, "gallery.html"), topics: resolve(__dirname, "topics.html"), dialectPicker: resolve(__dirname, "dialect-picker.html") } },
  },
  server: {
    port: 5445,
    strictPort: true,
  },
});
