import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  root: path.resolve(__dirname, "match-live"),
  build: {
    outDir: path.resolve(__dirname, "dist-matchlive"),
    emptyOutDir: true,
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
            "/getfeed/5dc9cf20aca34682682708de71344f52",
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
