import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, "match-live"),
  build: {
    outDir: path.resolve(__dirname, "dist-matchlive"),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "match-live/index.html"),
        dual: path.resolve(__dirname, "match-live/dual.html"),
        manager: path.resolve(__dirname, "match-live/manager.html"),
      },
    },
  },
  css: {
    postcss: path.resolve(__dirname, "postcss.config.js"),
  },
  server: {
    port: 5175,
    proxy: {
      "/api/goalserve": {
        target: "http://www.goalserve.com",
        changeOrigin: true,
        rewrite: (p) =>
          p.replace(
            "/api/goalserve",
            "/getfeed/edc0ecd4f73c4c1a20f808dea8e5ebf2",
          ),
      },
      "/api/odds": {
        target: "https://api.the-odds-api.com",
        changeOrigin: true,
        secure: false,
        rewrite: (p) => p.replace("/api/odds", "/v4"),
      },
    },
  },
});
