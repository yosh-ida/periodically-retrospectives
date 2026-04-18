import React from "react";
import ReactDOM from "react-dom/client";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import App from "./App.tsx";

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/service-worker.js").catch((error) => {
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
