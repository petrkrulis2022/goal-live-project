import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import CreateEvent from "./pages/CreateEvent";
import EventDetail from "./pages/EventDetail";
import FundPool from "./pages/FundPool";
import { useAdminWallet } from "./hooks/useAdminWallet";

export default function App() {
  const wallet = useAdminWallet();

  // ── Not connected ────────────────────────────────────────────────────────────
  if (wallet.status === "disconnected" || wallet.status === "connecting") {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-4">⚽</div>
          <h1 className="text-2xl font-bold mb-2">
            <span className="text-green-400">goal.live</span>{" "}
            <span className="text-gray-400 text-lg font-normal">admin</span>
          </h1>
          <p className="text-gray-500 text-sm mb-8">
            Connect the platform wallet to continue.
          </p>
          {wallet.error && (
            <p className="text-red-400 text-xs mb-4 bg-red-400/10 px-3 py-2 rounded-md">
              {wallet.error}
            </p>
          )}
          <button
            onClick={wallet.connect}
            disabled={wallet.status === "connecting"}
            className="px-6 py-3 bg-green-500 text-black font-semibold rounded-lg hover:bg-green-400 disabled:opacity-50 transition-colors"
          >
            {wallet.status === "connecting"
              ? "Connecting…"
              : "Connect MetaMask"}
          </button>
        </div>
      </div>
    );
  }

  // ── Wrong wallet ─────────────────────────────────────────────────────────────
  if (wallet.status === "wrong_wallet") {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="text-4xl mb-4">🚫</div>
          <h1 className="text-xl font-bold mb-2 text-red-400">Unauthorized</h1>
          <p className="text-gray-400 text-sm mb-2">
            Connected wallet is not the admin.
          </p>
          <p className="font-mono text-xs text-gray-600 bg-gray-900 px-3 py-2 rounded-md mb-6 break-all">
            {wallet.address}
          </p>
          <p className="text-gray-500 text-xs mb-6">
            Switch to{" "}
            <span className="font-mono text-gray-400">
              {wallet.adminAddress.slice(0, 6)}…{wallet.adminAddress.slice(-4)}
            </span>{" "}
            in MetaMask.
          </p>
          <button
            onClick={wallet.disconnect}
            className="px-4 py-2 bg-gray-800 text-gray-300 text-sm rounded-lg hover:bg-gray-700 transition-colors"
          >
            Disconnect
          </button>
        </div>
      </div>
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
