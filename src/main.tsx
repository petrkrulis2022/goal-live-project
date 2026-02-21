import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BettingOverlay } from "./components/BettingOverlay";
import "./styles/global.css";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      {/* Dev mode: render overlay directly on a dark page */}
      <div className="min-h-screen bg-gray-900 flex items-end justify-center">
        <BettingOverlay />
      </div>
    </QueryClientProvider>
  </React.StrictMode>,
);
