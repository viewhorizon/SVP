import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";
import AppErrorBoundary from "./components/AppErrorBoundary";

window.addEventListener("error", (event) => {
  console.error("[window.error]", event.error ?? event.message);
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("[window.unhandledrejection]", event.reason);
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>
);
