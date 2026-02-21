// Content-script IIFE build — single-entry, fully self-contained.
// IIFE format requires exactly ONE input; background.js is ESM-safe (MV3 service
// workers support ES modules) so it stays in the main vite.config.ts build.
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig(({ mode }) => {
  // Load .env so VITE_PLATFORM_WALLET etc. are available at build time
  const env = loadEnv(mode, process.cwd(), "VITE_");
  return {
    plugins: [react()],
    define: {
      "import.meta.env.VITE_USE_MOCK": '"true"',
      "import.meta.env.VITE_USE_REAL_WALLET": '"true"', // extension always uses MetaMask
      "import.meta.env.VITE_DEBUG": '"false"',
      "import.meta.env.VITE_APP_NAME": '"goal.live"',
      // Forward platform wallet address baked in at build time
      "import.meta.env.VITE_PLATFORM_WALLET": JSON.stringify(
        env.VITE_PLATFORM_WALLET ?? "",
      ),
      "import.meta.env.MODE": '"production"',
      "import.meta.env.PROD": "true",
      "import.meta.env.DEV": "false",
      "process.env.NODE_ENV": '"production"',
    },
    build: {
      outDir: "dist-content",
      emptyOutDir: true,
      cssCodeSplit: false,
      rollupOptions: {
        input: resolve(__dirname, "extension/content-script.tsx"),
        output: {
          format: "iife",
          inlineDynamicImports: true,
          entryFileNames: "content-script.js",
          assetFileNames: "content-script.[ext]",
        },
      },
    },
    resolve: {
      alias: { "@": resolve(__dirname, "src") },
    },
  };
});
