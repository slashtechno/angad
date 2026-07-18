import { Link, useLocation } from "react-router";
import type { ReactNode } from "react";

interface CityChromeProps {
  clockStr: string;
  humStr: string;
  /** Current quality tier from useCityAnimation. >0 means effects were reduced. */
  tier?: 0 | 1 | 2 | 3;
  /** Optional overlay rendered after the chrome (e.g. landing-page scroll/dots/panels) */
  overlay?: ReactNode;
  /** The content area; musings pages pass {children}, landing passes its sections */
  children: ReactNode;
}

export function CityChrome({ clockStr, humStr, tier = 0, overlay, children }: CityChromeProps) {
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

      {/* Quality warning (only when tier > 0) */}
      {tier > 0 && <QualityBadge tier={tier} />}

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

function QualityBadge({ tier }: { tier: number }) {
  // Map tier to a list of disabled effects for the tooltip
  const disabled: string[] = [];
  if (tier >= 1) disabled.push("shadows");
  if (tier >= 2) disabled.push("antialiasing", "high pixel ratio");
  if (tier >= 3) disabled.push("shadow detail");
  const tip = `Performance reduced: ${disabled.join(", ")} disabled to keep the city smooth.`;

  return (
    <div className="city-quality-warn" tabIndex={0} role="status" aria-label={tip}>
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        <polygon points="7,1 13,13 1,13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        <line x1="7" y1="6" x2="7" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="7" cy="11" r="0.8" fill="currentColor" />
      </svg>
      <span className="city-quality-tooltip">{tip}</span>
    </div>
  );
}
