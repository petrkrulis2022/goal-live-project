/// <reference types="chrome" />

import React from "react";
import ReactDOM from "react-dom/client";
import { ClickablePlayersLab } from "../src/components/ClickablePlayersLab";

const CONTAINER_ID = "goal-live-clickable-lab";
let currentRoot: ReturnType<typeof ReactDOM.createRoot> | null = null;
let retryTimer: number | null = null;

function renderStartupError(message: string) {
  const existing = document.getElementById(`${CONTAINER_ID}-error`);
  existing?.remove();

  const errorBanner = document.createElement("div");
  errorBanner.id = `${CONTAINER_ID}-error`;
  errorBanner.textContent = `goal.live clickable lab failed: ${message}`;
  Object.assign(errorBanner.style, {
    position: "fixed",
    top: "12px",
    right: "12px",
    zIndex: "2147483647",
    background: "rgba(127, 29, 29, 0.96)",
    color: "#fee2e2",
    border: "1px solid rgba(248, 113, 113, 0.7)",
    borderRadius: "10px",
    padding: "10px 12px",
    fontFamily: "system-ui, sans-serif",
    fontSize: "12px",
    fontWeight: "700",
    maxWidth: "360px",
    boxShadow: "0 10px 28px rgba(0,0,0,0.35)",
  });
  document.body.appendChild(errorBanner);
}

function injectApp() {
  if (!document.body) return;

  const existing = document.getElementById(CONTAINER_ID);
  if (existing) {
    currentRoot?.unmount();
    existing.remove();
    currentRoot = null;
  }

  const container = document.createElement("div");
  container.id = CONTAINER_ID;
  document.body.appendChild(container);

  try {
    currentRoot = ReactDOM.createRoot(container);
    currentRoot.render(
      <React.StrictMode>
        <ClickablePlayersLab />
      </React.StrictMode>,
    );
  } catch (error) {
    console.error("goal.live clickable lab startup failed", error);
    renderStartupError(
      error instanceof Error ? error.message : "unknown startup error",
    );
  }
}

function scheduleInject(delayMs = 0) {
  if (retryTimer !== null) {
    window.clearTimeout(retryTimer);
  }

  retryTimer = window.setTimeout(() => {
    retryTimer = null;
    injectApp();
  }, delayMs);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => scheduleInject(), {
    once: true,
  });
} else {
  scheduleInject();
}

window.addEventListener("load", () => scheduleInject(150));

const observer = new MutationObserver(() => {
  if (!document.body) return;
  if (!document.getElementById(CONTAINER_ID)) {
    scheduleInject(100);
  }
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
});

window.addEventListener("yt-navigate-finish", () => {
  scheduleInject(400);
});
