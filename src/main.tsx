import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// ✅ Prevent Supabase aborted requests from showing as "Uncaught (in promise)"
window.addEventListener("unhandledrejection", (event) => {
  const msg = String((event.reason as any)?.message ?? event.reason ?? "").toLowerCase();
  if (msg.includes("abort")) {
    event.preventDefault();
  }
});

createRoot(document.getElementById("root")!).render(<App />);