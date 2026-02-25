import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// Standalone admin SPA — builds to dist-admin/
export default defineConfig({
  plugins: [react()],
  root: resolve(__dirname, "admin"),
  build: {
    outDir: resolve(__dirname, "dist-admin"),
    emptyOutDir: true,
  },
  server: {
    port: 5174,
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "admin/src"),
      "@shared": resolve(__dirname, "src"),
    },
  },
});
