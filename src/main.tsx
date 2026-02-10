import React from "react";
import ReactDOM from "react-dom/client";
import { i18nReady } from "./i18n";
import App from "./App";
import "./styles/global.css";

// Wait for i18n locale to load (code-split) before rendering
i18nReady.then(() => {
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
