import { useEffect, useRef } from "react";
import { useLocation } from "react-router";

declare global {
  interface Window {
    goatcounter?: { count: (vars?: { path?: string }) => void };
  }
}

const ENDPOINT = "https://sudo.goatcounter.com/count";

/** Loads GoatCounter once and records a pageview on every route change (SPA navigations don't trigger a real page load). */
export default function GoatCounter() {
  const location = useLocation();
  const loaded = useRef(false);

  useEffect(() => {
    if (loaded.current) {
      window.goatcounter?.count({ path: location.pathname });
      return;
    }
    loaded.current = true;

    const script = document.createElement("script");
    script.async = true;
    script.src = "/assets/count.js";
    script.dataset.goatcounter = ENDPOINT;
    script.dataset.goatcounterSettings = JSON.stringify({ no_onload: true });
    script.onload = () => window.goatcounter?.count({ path: location.pathname });
    document.body.appendChild(script);
  }, [location.pathname]);

  return null;
}
