import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, "hockey-live"),
  build: {
    outDir: path.resolve(__dirname, "dist-hockeylive"),
    emptyOutDir: true,
  },
  css: {
    postcss: path.resolve(__dirname, "postcss.config.js"),
  },
  server: {
    port: 5176,
    proxy: {
      "/api/hockey": {
        target:
          "https://www.goalserve.com/getfeed/edc0ecd4f73c4c1a20f808dea8e5ebf2/hockey",
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace("/api/hockey", ""),
      },
    },
  },
});
