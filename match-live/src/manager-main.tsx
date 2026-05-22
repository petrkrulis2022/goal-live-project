import React from "react";
import ReactDOM from "react-dom/client";
import LiveManager from "./LiveManager";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("manager-root")!).render(
  <React.StrictMode>
    <LiveManager />
  </React.StrictMode>,
);
