import React from "react";
import ReactDOM from "react-dom/client";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import App from "./App.tsx";
import { registerPwaLifecycleListeners } from "./features/notifications/runtime.ts";

registerPwaLifecycleListeners();

if ("serviceWorker" in navigator) {
  const serviceWorkerUrl = new URL("service-worker.js", new URL(import.meta.env.BASE_URL, window.location.origin));

  navigator.serviceWorker.register(serviceWorkerUrl).catch((error) => {
    console.warn("Failed to register service worker", error);
  });
}

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#13343b"
    },
    secondary: {
      main: "#b5694d"
    },
    background: {
      default: "#f4efe7",
      paper: "#fffaf3"
    }
  },
  shape: {
    borderRadius: 20
  },
  typography: {
    fontFamily: '"Segoe UI", "Hiragino Sans", sans-serif'
  }
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
