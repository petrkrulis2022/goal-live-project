// extension/content-script.tsx
// Injected into YouTube & tvgo.t-mobile.cz pages
import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BettingOverlay } from "../src/components/BettingOverlay";
import "../src/styles/global.css";

const CONTAINER_ID = "goal-live-extension";

// Inject page-world MetaMask bridge so walletBridgeService can reach window.ethereum
function injectEthBridge() {
  const existing = document.getElementById("gl-eth-bridge");
  if (existing) return;
  const script = document.createElement("script");
  script.id = "gl-eth-bridge";
  script.src = chrome.runtime.getURL("injected.js");
  script.onload = () => script.remove();
  (document.head ?? document.documentElement).appendChild(script);
}
injectEthBridge();

function injectApp() {
  if (document.getElementById(CONTAINER_ID)) return; // already mounted

  const container = document.createElement("div");
  container.id = CONTAINER_ID;
  document.body.appendChild(container);

  const queryClient = new QueryClient();
  const root = ReactDOM.createRoot(container);
  root.render(
    <QueryClientProvider client={queryClient}>
      <BettingOverlay />
    </QueryClientProvider>,
  );

  console.info("✅ goal.live extension loaded");
}

// Inject once DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", injectApp);
} else {
  injectApp();
}

// Re-inject on YouTube SPA navigation (yt-navigate-finish)
window.addEventListener("yt-navigate-finish", () => {
  const existing = document.getElementById(CONTAINER_ID);
  if (existing) existing.remove();
  setTimeout(injectApp, 500);
});
