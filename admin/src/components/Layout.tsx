import { NavLink, useNavigate } from "react-router-dom";
import type { ReactNode } from "react";

const NAV = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/events/new", label: "Create Event" },
];

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex">
      {/* Sidebar */}
      <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="px-5 py-5 border-b border-gray-800">
          <span className="text-lg font-bold tracking-tight text-green-400">
            goal.live
          </span>
          <span className="ml-2 text-xs text-gray-500 uppercase tracking-widest">
            admin
          </span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-green-500/10 text-green-400"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-gray-800 text-xs text-gray-600">
          goal.live v1.0 — MVP
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}
