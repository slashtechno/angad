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
    name: "podium",
    href: "https://github.com/hackclub/podium",
    description: "Hack Club's open-source peer-judging platform for hackathons.",
  },
  {
    name: "amped",
    href: "https://github.com/slashtechno/amped",
    description: "The missing account switcher for Amp and Claude Code.",
  },
  {
    name: "jet-fund",
    href: "https://github.com/hackclub/jet-fund",
    description: "Get free flights/bus/train tickets just by programming.",
  },
  {
    name: "cloudflare-gateway-adblocking",
    href: "https://github.com/slashtechno/cloudflare-gateway-adblocking",
    description: "Serverless ad blocking via Cloudflare Zero Trust gateway.",
  },
  {
    name: "dash-of-pi",
    href: "https://github.com/slashtechno/dash-of-pi",
    description: "A smart WiFi dashcam runnable on a Raspberry Pi.",
  },
  {
    name: "gobackup-github",
    href: "https://github.com/slashtechno/gobackup-github",
    description: "Go program that utilizes the GitHub API to backup repos.",
  },
] as const;
