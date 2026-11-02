import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import "./styles/app.css";

// Simple router for development test page
const Root = () => {
  if (window.location.pathname === '/controlfile-test') {
    return <App />;
  }
  
  return (
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
};

registerSW({
  immediate: true,
  onRegisteredSW(swUrl: string) {
    console.info("Service worker registrado:", swUrl);
  }
});

const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(<Root />);
