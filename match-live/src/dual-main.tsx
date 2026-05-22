import React from "react";
import ReactDOM from "react-dom/client";
import DualLive from "./DualLive";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("dual-root")!).render(
  <React.StrictMode>
    <DualLive />
  </React.StrictMode>,
);
