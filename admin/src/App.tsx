import { Routes, Route, Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import CreateEvent from "./pages/CreateEvent";
import EventDetail from "./pages/EventDetail";
import FundPool from "./pages/FundPool";
import { useAdminWallet } from "./hooks/useAdminWallet";

/** Shared full-screen wrapper for auth screens */
function AuthScreen({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center relative overflow-hidden">
      {/* Ambient glow blobs */}
      <div className="absolute top-[-120px] left-[-120px] w-[420px] h-[420px] rounded-full bg-green-500/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-80px] right-[-80px] w-[320px] h-[320px] rounded-full bg-emerald-600/8 blur-[80px] pointer-events-none" />
      <div className="relative z-10 w-full max-w-sm px-4">{children}</div>
    </div>
  );
}

export default function App() {
  const wallet = useAdminWallet();

  // ── Not connected ────────────────────────────────────────────────────────────
  if (wallet.status === "disconnected" || wallet.status === "connecting") {
    return (
      <AuthScreen>
        <div className="bg-gray-900/80 border border-white/8 rounded-2xl p-8 shadow-2xl backdrop-blur-sm text-center">
          {/* Logo */}
          <div className="flex items-center justify-center gap-2 mb-6">
            <span className="text-3xl">⚽</span>
            <span className="text-2xl font-bold tracking-tight text-white">
              goal<span className="text-green-400">.</span>live
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">
              admin
            </span>
          </div>

          <p className="text-gray-400 text-sm mb-6 leading-relaxed">
            Connect the platform wallet to access the admin console.
          </p>

          {wallet.error && (
            <div className="flex items-start gap-2 text-red-400 text-xs mb-5 bg-red-500/10 border border-red-500/20 px-3 py-2.5 rounded-lg text-left">
              <span className="mt-0.5">⚠</span>
              <span>{wallet.error}</span>
            </div>
          )}

          <button
            onClick={wallet.connect}
            disabled={wallet.status === "connecting"}
            className="w-full px-6 py-3 bg-green-500 text-black font-bold rounded-xl hover:bg-green-400 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150 text-sm tracking-wide shadow-lg shadow-green-500/20"
          >
            {wallet.status === "connecting" ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                Connecting…
              </span>
            ) : (
              "Connect MetaMask"
            )}
          </button>

          <p className="text-gray-600 text-xs mt-4">
            Requires MetaMask browser extension
          </p>
        </div>
      </AuthScreen>
    );
  }

  // ── Wrong wallet ─────────────────────────────────────────────────────────────
  if (wallet.status === "wrong_wallet") {
    return (
      <AuthScreen>
        <div className="bg-gray-900/80 border border-red-500/20 rounded-2xl p-8 shadow-2xl backdrop-blur-sm text-center">
          <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4 text-xl">
            🚫
          </div>
          <h1 className="text-xl font-bold mb-1 text-white">Unauthorized</h1>
          <p className="text-gray-400 text-sm mb-4">
            This wallet is not the admin address.
          </p>

          <div className="bg-gray-950 border border-white/5 rounded-lg px-3 py-2.5 mb-4">
            <p className="text-[10px] text-gray-600 uppercase tracking-wider mb-1">
              Connected
            </p>
            <p className="font-mono text-xs text-red-400 break-all">
              {wallet.address}
            </p>
          </div>

          <div className="bg-green-500/5 border border-green-500/15 rounded-lg px-3 py-2.5 mb-6 text-left">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">
              Required
            </p>
            <p className="font-mono text-xs text-green-400">
              {wallet.adminAddress.slice(0, 10)}…{wallet.adminAddress.slice(-6)}
            </p>
          </div>

          <p className="text-gray-500 text-xs mb-5">
            Switch accounts in MetaMask and the page will update automatically.
          </p>

          <button
            onClick={wallet.disconnect}
            className="px-5 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm font-medium rounded-lg transition-colors border border-white/5"
          >
            Disconnect
          </button>
        </div>
      </AuthScreen>
    );
  }

  // ── Authorized ───────────────────────────────────────────────────────────────
  return (
    <Layout address={wallet.address!} onDisconnect={wallet.disconnect}>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/events/new" element={<CreateEvent />} />
        <Route path="/events/:matchId" element={<EventDetail />} />
        <Route path="/events/:matchId/fund" element={<FundPool />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Layout>
  );
}
