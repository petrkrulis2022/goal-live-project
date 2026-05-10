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

  function getSolanaProvider() {
    if (
      window.phantom &&
      window.phantom.solana &&
      window.phantom.solana.isPhantom
    ) {
      return window.phantom.solana;
    }
    if (window.solana && window.solana.isPhantom) {
      return window.solana;
    }
    return null;
  }

  function postSolEvent(evt, data) {
    window.postMessage({ type: "GL_SOL_EVENT", event: evt, data: data }, "*");
  }

  function base64ToUint8Array(base64) {
    var bin = atob(base64);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  var solanaListenersAttached = false;
  function attachSolanaListeners() {
    if (solanaListenersAttached) return;
    var sol = getSolanaProvider();
    if (!sol || !sol.on) return;
    solanaListenersAttached = true;
    sol.on("connect", function () {
      postSolEvent("connect", {
        address: sol.publicKey ? sol.publicKey.toBase58() : null,
      });
    });
    sol.on("disconnect", function () {
      postSolEvent("disconnect", null);
    });
    sol.on("accountChanged", function (pk) {
      postSolEvent("accountChanged", {
        address: pk ? pk.toBase58() : null,
      });
    });
    window.postMessage(
      {
        type: "GL_SOL_READY",
        isPhantom: !!sol.isPhantom,
        address: sol.publicKey ? sol.publicKey.toBase58() : null,
      },
      "*",
    );
  }

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

  // Handle Solana provider relay for isolated content scripts
  window.addEventListener("message", async function (event) {
    if (event.source !== window) return;
    if (!event.data || event.data.type !== "GL_SOL_REQUEST") return;

    var reqId = event.data.reqId;
    var method = event.data.method;
    var params = event.data.params;

    try {
      var sol = getSolanaProvider();
      if (!sol) throw new Error("Phantom not found");

      var result = null;
      if (method === "connect") {
        var resp = await sol.connect();
        var connectedPk =
          resp && resp.publicKey
            ? resp.publicKey.toBase58()
            : sol.publicKey
              ? sol.publicKey.toBase58()
              : null;
        result = { address: connectedPk };
      } else if (method === "getPublicKey") {
        result = { address: sol.publicKey ? sol.publicKey.toBase58() : null };
      } else if (method === "signAndSendTransaction") {
        var serializedTx = params && params.serializedTransaction;
        var serializedTxBase58 = params && params.serializedTransactionBase58;
        if (!serializedTx) {
          throw new Error(
            "Missing serializedTransaction for Solana bridge call.",
          );
        }

        var txBytes = base64ToUint8Array(serializedTx);
        var rpcResult;

        // Preferred for Phantom request(): base58 serialized message payload.
        if (
          !rpcResult &&
          typeof sol.request === "function" &&
          serializedTxBase58
        ) {
          try {
            rpcResult = await sol.request({
              method: "signAndSendTransaction",
              params: { message: serializedTxBase58 },
            });
          } catch (_e0) {
            // continue
          }
        }

        // Preferred path: Phantom provider direct method.
        try {
          if (typeof sol.signAndSendTransaction === "function") {
            rpcResult = await sol.signAndSendTransaction(txBytes);
          }
        } catch (_e1) {
          // ignore and continue with request() variants below
        }

        if (!rpcResult && typeof sol.request === "function") {
          try {
            rpcResult = await sol.request({
              method: "signAndSendTransaction",
              params: { transaction: txBytes },
            });
          } catch (_e2) {
            try {
              rpcResult = await sol.request({
                method: "signAndSendTransaction",
                params: {
                  serializedTransaction: serializedTxBase58 || serializedTx,
                },
              });
            } catch (_e3) {
              rpcResult = await sol.request({
                method: "signAndSendTransaction",
                params: { message: serializedTxBase58 || serializedTx },
              });
            }
          }
        }

        if (!rpcResult) {
          throw new Error("Phantom failed to sign/send transaction in bridge.");
        }

        var signature =
          (rpcResult && rpcResult.signature) ||
          (rpcResult && rpcResult.result && rpcResult.result.signature) ||
          rpcResult;
        result = { signature: signature };
      } else {
        throw new Error("Unsupported Solana bridge method: " + method);
      }

      window.postMessage(
        { type: "GL_SOL_RESPONSE", reqId: reqId, result: result },
        "*",
      );
    } catch (err) {
      window.postMessage(
        {
          type: "GL_SOL_RESPONSE",
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

  // Phantom may inject asynchronously; try for a short period after page load.
  attachSolanaListeners();
  var solAttachTries = 0;
  var solAttachInterval = setInterval(function () {
    solAttachTries += 1;
    attachSolanaListeners();
    if (solanaListenersAttached || solAttachTries >= 30) {
      clearInterval(solAttachInterval);
    }
  }, 500);
})();
