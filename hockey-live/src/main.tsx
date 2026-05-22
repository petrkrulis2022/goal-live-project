import React from "react";
import ReactDOM from "react-dom/client";
import HockeyManager from "./HockeyManager";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("hockey-root")!).render(
  <React.StrictMode>
    <HockeyManager />
  </React.StrictMode>,
);
