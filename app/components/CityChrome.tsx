import { Link, useLocation } from "react-router";
import type { ReactNode } from "react";

interface CityChromeProps {
  clockStr: string;
  humStr: string;
  /** Optional overlay rendered after the chrome (e.g. landing-page scroll/dots/panels) */
  overlay?: ReactNode;
  /** The content area; musings pages pass {children}, landing passes its sections */
  children: ReactNode;
}

export function CityChrome({ clockStr, humStr, overlay, children }: CityChromeProps) {
  const location = useLocation();
  const isHome = location.pathname === "/";

  return (
    <>
      {/* Vignette + grain overlays (shared visual layer above canvas) */}
      <div className="city-vignette" />
      <div className="city-grain" />

      {/* Top-left: brand */}
      <div className="city-ui city-ui-tl">
        <div className="city-logo">ANGAD</div>
        <div className="city-logo-sub">// field notes</div>
        <div className="city-copy"><span>© 2026</span><span>slashtechno</span></div>
        {!isHome && <Link to="/" className="city-back">← back home</Link>}
      </div>

      {/* Top-right: manifesto */}
      <div className="city-ui city-ui-tr">
        <div className="city-manifesto-tag">//// Now</div>
        <div className="city-manifesto-title">Tending the garden</div>
        <div className="city-manifesto-text">Writing, building side projects, learning new things.</div>
      </div>

      {/* Bottom-left: ambient readout */}
      <div className="city-ambient">
        <div className="row"><span className="label">local</span><span>{clockStr}</span></div>
        <div className="row"><span className="label">signal</span><span className="city-blink">● live</span></div>
        <div className="row"><span className="label">lat/lng</span><span>37.7749° N, 122.4194° W</span></div>
        <div className="row"><span className="label">hum</span><span>{humStr}</span></div>
      </div>

      {overlay}

      <div className="city-content">{children}</div>
    </>
  );
}
