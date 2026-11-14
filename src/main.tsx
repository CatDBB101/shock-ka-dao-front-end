import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { FireCalendarProvider } from "./lib/firecalendar";
import "./styles/firecalendar.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <FireCalendarProvider>
      <App />
    </FireCalendarProvider>
  </StrictMode>,
);
