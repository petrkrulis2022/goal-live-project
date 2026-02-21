// extension/background.ts — Manifest v3 service worker

chrome.runtime.onInstalled.addListener(() => {
  console.log("goal.live extension installed (Phase 1 mock)");
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "GET_VERSION") {
    sendResponse({ version: chrome.runtime.getManifest().version });
  }
});
