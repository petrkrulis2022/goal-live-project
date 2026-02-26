// extension/content-script.tsx
// Injected into YouTube & tvgo.t-mobile.cz pages
import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BettingOverlay } from "../src/components/BettingOverlay";
import "../src/styles/global.css";

const CONTAINER_ID = "goal-live-extension";
let currentRoot: ReturnType<typeof ReactDOM.createRoot> | null = null;

// Minimal error boundary so React crashes surface visibly instead of blank screen
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(e: Error) {
    return { error: e };
  }
  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            position: "fixed",
            top: 12,
            left: "50%",
            transform: "translateX(-50%)",
            background: "#450a0a",
            border: "1px solid #ef4444",
            borderRadius: 8,
            padding: "10px 18px",
            zIndex: 2147483647,
            fontFamily: "system-ui,sans-serif",
            color: "#fca5a5",
            fontSize: 12,
            maxWidth: 400,
          }}
        >
          <strong style={{ color: "#ef4444" }}>goal.live error: </strong>
          {this.state.error.message}
        </div>
      );
    }
    return this.props.children;
  }
}

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

function injectApp(matchKey?: string) {
  // Tear down any existing instance first
  const existing = document.getElementById(CONTAINER_ID);
  if (existing) {
    currentRoot?.unmount();
    existing.remove();
    currentRoot = null;
  }

  const container = document.createElement("div");
  container.id = CONTAINER_ID;
  document.body.appendChild(container);

  const queryClient = new QueryClient();
  currentRoot = ReactDOM.createRoot(container);

  if (!matchKey) {
    // No match selected yet — minimal prompt to open popup
    currentRoot.render(
      <div
        style={{
          position: "fixed",
          top: 12,
          left: "50%",
          transform: "translateX(-50%)",
          background: "#0a0c0f",
          border: "1px solid #10b981",
          borderRadius: 8,
          padding: "10px 18px",
          zIndex: 2147483647,
          fontFamily: "system-ui,sans-serif",
          color: "#e5e7eb",
          fontSize: 13,
          display: "flex",
          alignItems: "center",
          gap: 10,
          boxShadow: "0 4px 24px rgba(0,0,0,0.6)",
        }}
      >
        <span style={{ color: "#10b981", fontSize: 18 }}>⚽</span>
        <span>
          <strong style={{ color: "#10b981" }}>goal.live</strong>
          {" — click the extension icon to select a match"}
        </span>
      </div>,
    );
    return;
  }

  currentRoot.render(
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BettingOverlay matchKey={matchKey} />
      </QueryClientProvider>
    </ErrorBoundary>,
  );

  console.info(`✅ goal.live loaded [${matchKey}]`);
}

// Boot: read saved matchKey from storage, then inject
function boot() {
  chrome.storage.local.get("matchKey", (result) => {
    injectApp(result.matchKey as string | undefined);
  });
}

// Re-inject when popup writes a new matchKey (fires only if value changed)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.matchKey) {
    const newKey = changes.matchKey.newValue as string | undefined;
    injectApp(newKey);
  }
});

// Direct message from popup — fires even when matchKey value is unchanged
// (storage.onChanged won't fire if the same key is already stored)
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "GOAL_LIVE_MATCH_SELECTED") {
    injectApp(message.matchKey as string | undefined);
  }
});

// Initial injection
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}

// Re-inject on YouTube SPA navigation
window.addEventListener("yt-navigate-finish", () => {
  setTimeout(() => {
    chrome.storage.local.get("matchKey", (result) => {
      injectApp(result.matchKey as string | undefined);
    });
  }, 500);
});
