import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { viteStaticCopy } from "vite-plugin-static-copy";

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        { src: "extension/manifest.json", dest: "." },
        { src: "extension/popup.html", dest: "." },
        { src: "extension/icons", dest: "." },
        // injected.js runs in page world — must NOT be bundled by Vite
        { src: "extension/injected.js", dest: "." },
        // Logo as a static asset accessible via chrome.runtime.getURL()
        { src: "extension/goal-live-logo.png", dest: "." },
        // Advertisement buttons
        { src: "extension/ad-cubepay.png", dest: "." },
        { src: "extension/ad-vibe.png", dest: "." },
      ],
    }),
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        contentScript: resolve(__dirname, "extension/content-script.tsx"),
        background: resolve(__dirname, "extension/background.ts"),
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === "contentScript") return "content-script.js";
          if (chunk.name === "background") return "background.js";
          return "assets/[name]-[hash].js";
        },
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: (info) => {
          if (info.name?.endsWith(".css")) return "content-styles.css";
          return "assets/[name]-[hash][extname]";
        },
      },
    },
  },
  resolve: {
    alias: { "@": resolve(__dirname, "src") },
  },
});
