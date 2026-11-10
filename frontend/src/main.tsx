import React from "react";
import ReactDOM from "react-dom/client";
import "./app/styles/index.css";
import "@/shared/ui/primitives";
import { App } from "./app";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
