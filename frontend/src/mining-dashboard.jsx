import React from "react";
import ReactDOM from "react-dom/client";
import { MiningExecutiveDashboard } from "./components/MiningExecutiveDashboard";
import "./mining-dashboard.css";

ReactDOM.createRoot(document.getElementById("mining-root")).render(
  <React.StrictMode>
    <MiningExecutiveDashboard />
  </React.StrictMode>
);
