import { useEffect, useRef, useState, useCallback } from "react";
import { lerp, ss } from "../lib/cityScene";
import { useCityAnimation } from "../lib/useCityAnimation";
import { useClock } from "../lib/useClock";
import { EMAIL, SITE_LINKS, SITE_PROJECTS } from "../lib/links";
import { CityChrome } from "../components/CityChrome";
import "../city.css";

const camPath = [
  { pos: [0, 18, 55], look: [0, 8, 0] },     // hero
  { pos: [-12, 4, 20], look: [2, 5, 0] },      // about
  { pos: [6, 5, -4], look: [-6, 6, -22] },     // projects
  { pos: [4, 3, -30], look: [-2, 5, -50] },    // now
  { pos: [0, 12, -60], look: [0, 8, 0] },      // end
];
const sections = ["Hi", "About", "Projects", "Now", "—"];

// ── Component ───────────────────────────────────
export default function CityLanding() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentSection, setCurrentSection] = useState(0);
  const currentSectionRef = useRef(0);
  const { clockStr, dateStr } = useClock();
  const [smoothProgress, setSmoothProgress] = useState(0);
  const progressRef = useRef({ target: 0, smooth: 0 });
  const mouseRef = useRef({ x: 0, y: 0 });

  // ── Body class ────────────────────────────────
  useEffect(() => {
    document.body.classList.add("city-landing");
    return () => document.body.classList.remove("city-landing");
  }, []);

  // ── Scroll progress ──────────────────────────
  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      progressRef.current.target = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX / window.innerWidth - 0.5;
      mouseRef.current.y = e.clientY / window.innerHeight - 0.5;
    };
    window.addEventListener("mousemove", onMouse);
    return () => window.removeEventListener("mousemove", onMouse);
  }, []);

  // ── Three.js scene ────────────────────────────
  const { tier } = useCityAnimation({
    canvasRef: canvasRef,
    city: {
      fog: 0.012,
      initialCameraPos: [0, 18, 65],
      initialCameraLook: [0, 8, 0],
    },
    updateCamera: (camera, t) => {
      const p = progressRef.current;
      const idx = p.smooth * (camPath.length - 1);
      const i0 = Math.floor(idx), i1 = Math.min(camPath.length - 1, i0 + 1);
      const lt = ss(idx - i0);
      const c0 = camPath[i0], c1 = camPath[i1];
      const mx = mouseRef.current.x, my = mouseRef.current.y;
      camera.position.set(
        lerp(c0.pos[0], c1.pos[0], lt) + mx * 1.5 + Math.sin(t * 0.3) * 0.3,
        lerp(c0.pos[1], c1.pos[1], lt) + my * 0.5 + Math.sin(t * 0.4) * 0.2,
        lerp(c0.pos[2], c1.pos[2], lt));
      camera.lookAt(
        lerp(c0.look[0], c1.look[0], lt),
        lerp(c0.look[1], c1.look[1], lt),
        lerp(c0.look[2], c1.look[2], lt));
    },
    onTick: (t, dt) => {
      const p = progressRef.current;
      p.smooth = lerp(p.smooth, p.target, dt * 4);
      setSmoothProgress(p.smooth);

      const secIdx = Math.round(p.smooth * 4);
      if (secIdx !== currentSectionRef.current) { currentSectionRef.current = secIdx; setCurrentSection(secIdx); }
    },
  });

  const scrollToSection = useCallback((i: number) => {
    window.scrollTo({ top: (i / 4) * (document.documentElement.scrollHeight - window.innerHeight), behavior: "smooth" });
  }, []);

  const sec = currentSection;
  const github = SITE_LINKS.find((l) => l.label === "github")!;
  const photography = SITE_LINKS.find((l) => l.label === "photography")!;
  const meeting = SITE_LINKS.find((l) => l.label === "schedule a meeting")!;

  return (
    <>
      <canvas ref={canvasRef} className="city-landing-canvas" />
      <CityChrome clockStr={clockStr} dateStr={dateStr} tier={tier} overlay={
        <>
          {/* Scroll hint */}
          <div className={`city-scroll-hint${sec === 0 ? "" : " hidden"}`}>scroll ↓</div>

          {/* Dots */}
          <div className="city-dots">
            {sections.map((_, i) => (
              <div key={i} className={`city-dot${i === sec ? " active" : ""}`} onClick={() => scrollToSection(i)} />
            ))}
          </div>

          {/* Section info */}
          <div className={`city-section-info${sec > 0 ? "" : " hidden"}`}>
            <div className="city-section-num">{String(sec + 1).padStart(2, "0")}</div>
            <div className="city-section-title">{sections[sec]}</div>
          </div>

          {/* Scroll bar */}
          <div className="city-scroll-bar">
            <div className="city-scroll-fill" style={{ transform: `scaleX(${smoothProgress})` }} />
          </div>
        </>
      }>
        {/* Hero */}
        <div className={`city-hero${sec === 0 ? " visible" : ""}`}>
          Hi! I'm <span className="city-accent">Angad</span>.
          <div className="city-hero-sub">High-school student, photographer, and software developer.</div>
          <div className="city-hero-cta">
            {SITE_LINKS.map((l, i) => (
              <span key={l.href}>
                <a href={l.href} target={l.external ? "_blank" : undefined} rel={l.external ? "noopener noreferrer" : undefined}>{l.label}</a>
                {i < SITE_LINKS.length - 1 && <span className="sep">·</span>}
              </span>
            ))}
          </div>
        </div>

        {/* About */}
        <div className={`city-panel left${sec === 1 ? " visible" : ""}`}>
          <div className="city-panel-tag">// About</div>
          <h2>What I do</h2>
          <p>I build software, take photos, and write the occasional musing. The software lives on <a href={github.href} target="_blank" rel="noopener noreferrer">GitHub</a>; the photos live on <a href={photography.href} target="_blank" rel="noopener noreferrer">Instagram</a>.</p>
          <p>I joined <a href="https://hackclub.com/" target="_blank" rel="noopener noreferrer">Hack Club</a> in 2024 and spent a stretch contracting on <a href="https://podium.hackclub.com" target="_blank" rel="noopener noreferrer">Podium</a>. Before that, I rode a train across Canada for a hackathon (<a href="https://boreal.hackclub.com/" target="_blank" rel="noopener noreferrer">Boreal</a>).</p>
        </div>

        {/* Projects */}
        <div className={`city-panel right${sec === 2 ? " visible" : ""}`}>
          <div className="city-panel-tag">// Projects</div>
          <h2>Recent projects</h2>
          <p className="city-panel-lead">A few of the things I've built. Most live on GitHub.</p>
          <ul className="city-projects">
            {SITE_PROJECTS.map((p) => (
              <li key={p.href}>
                <a href={p.href} target="_blank" rel="noopener noreferrer">
                  <span className="title">{p.name}</span>
                  <span className="desc">{p.description}</span>
                  <span className="stars">★ {p.stars}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Now */}
        <div className={`city-panel left${sec === 3 ? " visible" : ""}`}>
          <div className="city-panel-tag">// Now</div>
          <h2>What I'm up to</h2>
          <div className="meta">2026</div>
          <p>Back to tending the garden. Writing, smaller side projects, learning things I don't have a deadline for.</p>
          <p>Want to chat? <a href={meeting.href} target="_blank" rel="noopener noreferrer">Schedule a meeting</a> or email <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.</p>
        </div>

        {/* End */}
        <div className={`city-panel center${sec === 4 ? " visible" : ""}`}>
          <div className="city-panel-tag">// End</div>
          <h2>Thanks for visiting.</h2>
          <p><a href={`mailto:${EMAIL}`}>{EMAIL}</a></p>
        </div>
      </CityChrome>
    </>
  );
}
