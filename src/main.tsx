import React from "react";
import ReactDOM from "react-dom/client";
import "./i18n";
import App from "./App";
import "./styles/global.css";

// i18n module uses top-level await, so translations are ready by this point
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
