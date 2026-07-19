import { Link, useLocation } from "react-router";
import type { ReactNode } from "react";
import { SITE_LINKS } from "../lib/links";

interface CityChromeProps {
  /** Current quality tier from useCityAnimation. >0 means effects were reduced. */
  tier?: 0 | 1 | 2 | 3;
  /** Optional overlay rendered after the chrome (e.g. landing-page scroll/dots/panels) */
  overlay?: ReactNode;
  /** The content area; musings pages pass {children}, landing passes its sections */
  children: ReactNode;
}

export function CityChrome({ tier = 0, overlay, children }: CityChromeProps) {
  const location = useLocation();
  const isHome = location.pathname === "/";

  return (
    <>
      {/* Vignette + grain overlays (shared visual layer above canvas) */}
      <div className="city-vignette" />
      <div className="city-grain" />

      {/* Top-left: brand */}
      <div className="city-ui city-ui-tl">
        <div className="city-logo">ANGAD BEHL</div>
        <div className="city-logo-sub">// field notes</div>
        <div className="city-copy"><span>© 2026</span><span>angadbehl</span></div>
        {!isHome && <Link to="/" className="city-back">← back home</Link>}
      </div>

      {/* Top-right: link list — same links the original site exposes on home */}
      <nav className="city-ui city-ui-tr" aria-label="Primary">
        {SITE_LINKS.map((l) => (
          <a key={l.href} href={l.href} target={l.external ? "_blank" : undefined} rel={l.external ? "noopener noreferrer" : undefined}>
            {l.label}
          </a>
        ))}
      </nav>

      {/* Quality warning (only when tier > 0) */}
      {tier > 0 && <QualityBadge tier={tier} />}

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
