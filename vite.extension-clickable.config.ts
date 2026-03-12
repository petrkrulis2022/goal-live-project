import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        { src: "extension-clickable/manifest.json", dest: "." },
        { src: "extension-clickable/popup.html", dest: "." },
        { src: "extension/icons", dest: "." },
      ],
    }),
  ],
  build: {
    outDir: "dist-clickable",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        contentScript: resolve(
          __dirname,
          "extension-clickable/content-script.tsx",
        ),
      },
      output: {
        entryFileNames: "content-script.js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
  resolve: {
    alias: { "@": resolve(__dirname, "src") },
  },
});
