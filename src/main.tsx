import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { Provider } from "@/components/ui/provider"

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("Root element #root not found in index.html");
}

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <Provider>
      <App />
    </Provider>
  </React.StrictMode>
);
