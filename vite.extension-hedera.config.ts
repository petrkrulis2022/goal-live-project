// Hedera Testnet extension build.
// Produces a complete, loadable Chrome extension in dist-hedera/.
//
// Key difference from vite.extension.config.ts:
//   @/services barrel import is aliased to src/services/hedera/index.ts,
//   which uses walletBridgeServiceHedera (Hedera chain + USDC) instead of
//   the Sepolia wallet bridge used by the CRE extension.
//
// After build, dist-hedera/ is a complete Chrome extension directory:
//   - Load it in chrome://extensions → Load unpacked → select dist-hedera/
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { copyFileSync, cpSync, existsSync, mkdirSync } from "fs";

/** Inline plugin: assemble the full extension directory in dist-hedera/ */
function assembleHederaExtension() {
  return {
    name: "assemble-hedera-extension",
    closeBundle() {
      const out = resolve(__dirname, "dist-hedera");
      const extSrc = resolve(__dirname, "extension");
      const built = resolve(__dirname, "dist-content-hedera");
      // background.js is compiled from background.ts by the main vite build (dist/)
      const mainDist = resolve(__dirname, "dist");
      mkdirSync(out, { recursive: true });

      // Built content-script (from this vite build)
      copyFileSync(`${built}/content-script.js`, `${out}/content-script.js`);
      const cssPath = `${built}/content-script.css`;
      if (existsSync(cssPath)) {
        copyFileSync(cssPath, `${out}/content-styles.css`);
      }

      // background.js — compiled by main vite build; fall back to copying
      // extension/background.ts as-is if the main dist isn't present yet
      const bgBuilt = `${mainDist}/background.js`;
      if (existsSync(bgBuilt)) {
        copyFileSync(bgBuilt, `${out}/background.js`);
      }

      // Static extension files (injected bridge, popup, assets)
      const staticFiles = [
        "injected.js",
        "popup.html",
        "popup.js",
        "goal-live-logo.png",
        "goal-live-logo-dark.png",
        "ad-cubepay.png",
        "ad-vibe.png",
      ];
      for (const f of staticFiles) {
        const s = `${extSrc}/${f}`;
        if (existsSync(s)) copyFileSync(s, `${out}/${f}`);
      }

      // Icons directory
      const iconsDir = `${extSrc}/icons`;
      if (existsSync(iconsDir)) {
        cpSync(iconsDir, `${out}/icons`, { recursive: true });
      }

      // Hedera manifest
      copyFileSync(
        resolve(__dirname, "extension-hedera/manifest.json"),
        `${out}/manifest.json`,
      );

      console.log("✅ dist-hedera/ assembled — load as unpacked extension");
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  return {
    plugins: [react(), assembleHederaExtension()],
    define: {
      "import.meta.env.VITE_USE_MOCK": '"true"',
      "import.meta.env.VITE_USE_REAL_WALLET": '"true"',
      "import.meta.env.VITE_DEBUG": '"false"',
      "import.meta.env.VITE_APP_NAME": '"goal.live"',
      "import.meta.env.VITE_PLATFORM_WALLET": JSON.stringify(
        env.VITE_PLATFORM_WALLET ?? "",
      ),
      // Hedera USDC contract address (set in .env after deployment)
      "import.meta.env.VITE_HEDERA_USDC_CONTRACT": JSON.stringify(
        env.VITE_HEDERA_USDC_CONTRACT ?? "",
      ),
      "import.meta.env.MODE": '"production"',
      "import.meta.env.PROD": "true",
      "import.meta.env.DEV": "false",
      "process.env.NODE_ENV": '"production"',
    },
    build: {
      outDir: "dist-content-hedera",
      emptyOutDir: true,
      cssCodeSplit: false,
      rollupOptions: {
        input: resolve(__dirname, "extension-hedera/content-script.tsx"),
        output: {
          format: "iife",
          inlineDynamicImports: true,
          entryFileNames: "content-script.js",
          assetFileNames: "content-script.[ext]",
        },
      },
    },
    resolve: {
      alias: [
        // Redirect the @/services barrel to the Hedera service index.
        // This makes BettingOverlay use walletBridgeServiceHedera automatically.
        // More specific entry must come BEFORE the generic @ alias.
        {
          find: /^@\/services$/,
          replacement: resolve(__dirname, "src/services/hedera/index.ts"),
        },
        { find: "@", replacement: resolve(__dirname, "src") },
      ],
    },
  };
});
