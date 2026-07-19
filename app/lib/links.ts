// Shared link list — single source of truth for the site's external links.
// Rendered in the chrome nav, the landing page hero CTA, and any future
// place that wants the same set.

export const SITE_DOMAIN = "angad.me";
export const EMAIL = `hi@${SITE_DOMAIN}`;

export interface SiteLink {
  label: string;
  href: string;
  external: boolean;
}

export const SITE_LINKS: readonly SiteLink[] = [
  { label: "musings", href: "/musings", external: false },
  { label: "github", href: "https://github.com/slashtechno", external: true },
  { label: "photography", href: "https://instagram.com/angadbehl", external: true },
  { label: "schedule a meeting", href: "https://meet.angad.me", external: true },
  { label: "linkedin", href: "https://linkedin.com/in/angadbehl", external: true },
] as const;

export interface SiteProject {
  name: string;
  href: string;
  description: string;
}

export const SITE_PROJECTS: readonly SiteProject[] = [
  {
    name: "cloudflare-gateway-adblocking",
    href: "https://github.com/slashtechno/cloudflare-gateway-adblocking",
    description: "Serverless ad blocking via Cloudflare Zero Trust gateway.",
  },
  {
    name: "amped",
    href: "https://github.com/slashtechno/amped",
    description: "The missing account switcher for Amp and Claude Code.",
  },
  {
    name: "wyzely-detect",
    href: "https://github.com/slashtechno/wyzely-detect",
    description: "Recognize faces/objects in a video stream and send notifications.",
  },
  {
    name: "api-failover",
    href: "https://github.com/slashtechno/api-failover",
    description: "Use the Cloudflare API to change DNS records to maximize uptime.",
  },
  {
    name: "llmail",
    href: "https://github.com/slashtechno/llmail",
    description: "Interact with LLMs / AI through email.",
  },
  {
    name: "tldscroll",
    href: "https://github.com/slashtechno/tldscroll",
    description: "A Slack bot that summarizes long messages and threads.",
  },
] as const;
