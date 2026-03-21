/**
 * goal.live — Page-World Ethereum Bridge
 *
 * Injected into the PAGE world (not isolated content-script world) so it can
 * see window.ethereum (MetaMask).  Relays requests/responses via postMessage.
 *
 * Content script  ──GL_ETH_REQUEST──▶  this script  ──▶  window.ethereum
 * Content script  ◀──GL_ETH_RESPONSE──  this script  ◀──  window.ethereum
 */
(function () {
  "use strict";

  // Forward MetaMask events to the content-script world
  function attachEthereumListeners() {
    if (!window.ethereum) return;
    window.ethereum.on("accountsChanged", function (accounts) {
      window.postMessage(
        { type: "GL_ETH_EVENT", event: "accountsChanged", data: accounts },
        "*",
      );
    });
    window.ethereum.on("chainChanged", function (chainId) {
      window.postMessage(
        { type: "GL_ETH_EVENT", event: "chainChanged", data: chainId },
        "*",
      );
    });
    // Tell the content script MetaMask is ready
    window.postMessage(
      { type: "GL_ETH_READY", isMetaMask: !!window.ethereum.isMetaMask },
      "*",
    );
  }

  // Handle RPC request relay
  window.addEventListener("message", async function (event) {
    if (event.source !== window) return;
    if (!event.data || event.data.type !== "GL_ETH_REQUEST") return;

    var reqId = event.data.reqId;
    var method = event.data.method;
    var params = event.data.params;

    try {
      if (!window.ethereum) throw new Error("MetaMask not found");
      var result = await window.ethereum.request({
        method: method,
        params: params,
      });
      window.postMessage(
        { type: "GL_ETH_RESPONSE", reqId: reqId, result: result },
        "*",
      );
    } catch (err) {
      window.postMessage(
        {
          type: "GL_ETH_RESPONSE",
          reqId: reqId,
          error: err && err.message ? err.message : String(err),
          code: err && err.code ? err.code : undefined,
        },
        "*",
      );
    }
  });

  // If multiple EVM wallets are installed, window.ethereum.providers is an array.
  // Force MetaMask to be the active provider so selectExtension doesn't fail.
  function resolveMetaMaskProvider() {
    if (!window.ethereum) return;
    if (window.ethereum.providers && Array.isArray(window.ethereum.providers)) {
      var mm = window.ethereum.providers.find(function (p) {
        return p.isMetaMask && !p.isBraveWallet;
      });
      if (mm) {
        // Override so all our calls go directly to MetaMask
        window.ethereum = mm;
      }
    }
  }

  // If ethereum is already present, attach immediately
  if (window.ethereum) {
    resolveMetaMaskProvider();
    attachEthereumListeners();
  } else {
    // MetaMask injects asynchronously on some pages — wait for it
    var ready = false;
    Object.defineProperty(window, "ethereum", {
      configurable: true,
      get: function () {
        return this._ethereum;
      },
      set: function (val) {
        this._ethereum = val;
        if (!ready) {
          ready = true;
          resolveMetaMaskProvider();
          attachEthereumListeners();
        }
      },
    });
  }
})();
