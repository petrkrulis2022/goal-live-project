import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// Standalone admin SPA — builds to dist-admin/
export default defineConfig({
  plugins: [react()],
  root: resolve(__dirname, "admin"),
  envDir: resolve(__dirname), // load .env from project root, not admin/
  build: {
    outDir: resolve(__dirname, "dist-admin"),
    emptyOutDir: true,
  },
  server: {
    port: 5174,
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
  resolve: {
    alias: {
      "@": resolve(__dirname, "admin/src"),
      "@shared": resolve(__dirname, "src"),
    },
  },
});
