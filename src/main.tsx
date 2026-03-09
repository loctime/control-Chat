import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import "./styles/app.css";

registerSW({
  immediate: true,
  onRegisteredSW(swUrl: string) {
    console.info("Service worker registrado:", swUrl);
  }
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
