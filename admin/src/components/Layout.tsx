import { NavLink } from "react-router-dom";
import type { ReactNode } from "react";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: "▦" },
  { to: "/events/new", label: "Create Event", icon: "＋" },
];

interface LayoutProps {
  children: ReactNode;
  address: string;
  onDisconnect: () => void;
}

export default function Layout({
  children,
  address,
  onDisconnect,
}: LayoutProps) {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex">
      {/* Sidebar */}
      <aside className="w-60 bg-gray-900 border-r border-white/5 flex flex-col shrink-0">
        {/* Brand */}
        <div className="px-5 py-5 border-b border-white/5">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚽</span>
            <span className="text-base font-bold tracking-tight text-white">
              goal<span className="text-green-400">.</span>live
            </span>
          </div>
          <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-600">
            Admin Console
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map(({ to, label, icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? "bg-green-500/12 text-green-400 shadow-sm"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={`text-base leading-none transition-colors ${isActive ? "text-green-400" : "text-gray-600 group-hover:text-gray-300"}`}
                  >
                    {icon}
                  </span>
                  {label}
                  {isActive && (
                    <span className="ml-auto w-1 h-1 rounded-full bg-green-400" />
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Wallet chip */}
        <div className="px-3 pb-4">
          <div className="bg-gray-950/60 border border-white/5 rounded-xl p-3">
            <div className="flex items-center gap-2 mb-2.5">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-50" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
              </span>
              <span className="text-[10px] text-gray-500 uppercase tracking-wider font-medium">
                Admin Wallet
              </span>
            </div>
            <p className="font-mono text-xs text-gray-300 mb-2.5">
              {address.slice(0, 8)}…{address.slice(-6)}
            </p>
            <button
              onClick={onDisconnect}
              className="w-full text-xs text-gray-600 hover:text-red-400 transition-colors text-left border border-transparent hover:border-red-500/20 hover:bg-red-500/5 px-2 py-1 rounded-md"
            >
              Disconnect ↗
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-gray-950">
        <div className="max-w-5xl mx-auto px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
