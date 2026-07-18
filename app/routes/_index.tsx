import { useEffect, useRef, useState, useCallback } from "react";
import type { Route } from "./+types/_index";
import { loadAllPostsParsed } from "../.server/posts";
import { lerp, ss } from "../lib/cityScene";
import { useCityAnimation } from "../lib/useCityAnimation";
import { CityChrome } from "../components/CityChrome";
import "../city.css";

export async function loader({}: Route.LoaderArgs) {
  const posts = await loadAllPostsParsed();
  return { posts: posts.slice(0, 5) };
}

const camPath = [
  { pos: [0, 22, 70], look: [0, 10, 0], time: 0.05 },
  { pos: [-14, 3, 30], look: [4, 5, 10], time: 0.3 },
  { pos: [0, 6, 5], look: [-10, 8, -25], time: 0.55 },
  { pos: [8, 2, -35], look: [-2, 4, -55], time: 0.78 },
  { pos: [0, 14, -75], look: [0, 10, 0], time: 0.97 },
];
const sections = ["About", "Author", "Shelf", "Now", "Contact"];

// ── Component ───────────────────────────────────
export default function CityLanding({ loaderData }: Route.ComponentProps) {
  const { posts } = loaderData;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentSection, setCurrentSection] = useState(0);
  const currentSectionRef = useRef(0);
  const [clockStr, setClockStr] = useState("--:--:--");
  const [humStr, setHumStr] = useState("— dB");
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
  useCityAnimation({
    canvasRef: canvasRef,
    city: {
      fog: 0.022,
      initialCameraPos: [0, 5, 30],
      initialCameraLook: [0, 4, 0],
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
    onTick: (t, dt, time) => {
      const p = progressRef.current;
      p.smooth = lerp(p.smooth, p.target, dt * 4);
      setSmoothProgress(p.smooth);

      const secIdx = Math.round(p.smooth * 4);
      if (secIdx !== currentSectionRef.current) { currentSectionRef.current = secIdx; setCurrentSection(secIdx); }

      setClockStr(`${String(Math.floor(6 + time * 18)).padStart(2, "0")}:${String(Math.floor((time * 18 * 60) % 60)).padStart(2, "0")}:${String(Math.floor(t * 60) % 60).padStart(2, "0")}`);
      setHumStr(`${(38 + Math.sin(t * 0.5) * 3 + Math.random() * 0.5).toFixed(1)} dB`);
    },
  });

  const scrollToSection = useCallback((i: number) => {
    window.scrollTo({ top: (i / 4) * (document.documentElement.scrollHeight - window.innerHeight), behavior: "smooth" });
  }, []);

  const sec = currentSection;

  return (
    <>
      <canvas ref={canvasRef} className="city-landing-canvas" />
      <CityChrome clockStr={clockStr} humStr={humStr} overlay={
        <>
          {/* Scroll hint */}
          <div className={`city-scroll-hint${sec === 0 ? "" : " hidden"}`}>Scroll down to enter the city ↓</div>

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
          a city<br />that <span className="city-accent">never</span><br />sits still.
          <div className="city-hero-sub">Tended slowly. Built one block at a time. A digital garden in motion.</div>
        </div>

        {/* Author */}
        <div className={`city-panel left${sec === 1 ? " visible" : ""}`}>
          <div className="city-panel-tag">// Author</div>
          <h2>slashtechno</h2>
          <p>Teen developer. I joined <a href="https://hackclub.com/">Hack Club</a> in late-May 2024 and found a community of 35,000+ teen programmers, hackers, and makers.</p>
          <p>I build things that scratch my own itch — bots, bridges, CMS rewrites, email-LLM clients. Whatever's interesting this month.</p>
        </div>

        {/* Shelf */}
        <div className={`city-panel right${sec === 2 ? " visible" : ""}`}>
          <div className="city-panel-tag">// Shelf</div>
          <h3>Recent writing</h3>
          <ul className="city-shelf">
            {posts.map((post, i) => (
              <li key={i}>
                <a href={post.relativeHref}>
                  <span className="title">{post.frontmatter.title}</span>
                  <span className="meta">{post.frontmatter.date} · {post.category}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Now */}
        <div className={`city-panel left${sec === 3 ? " visible" : ""}`}>
          <div className="city-panel-tag">// Now</div>
          <h2>Between things</h2>
          <div className="meta">2026 — present</div>
          <p>After a stretch building <a href="https://podium.hackclub.com">Podium</a> at <a href="https://hackclub.com/">Hack Club</a>, I'm back to tending the garden. Writing, smaller side projects, learning things I don't have a deadline for.</p>
          <p>Before that: a transcontinental train hackathon across Canada (<a href="https://boreal.hackclub.com/">Boreal</a>), and a long string of side projects — <a href="https://github.com/slashtechno/llmail">LLMail</a>, <a href="https://github.com/slashtechno/pystodon">Pystodon</a>, Synapse guides.</p>
        </div>

        {/* Contact */}
        <div className={`city-panel center${sec === 4 ? " visible" : ""}`}>
          <div className="city-panel-tag">// Contact</div>
          <h2>Get in touch</h2>
          <p>The best way to reach me is GitHub. I read everything, I just take a while to reply.</p>
          <p><a href="https://github.com/slashtechno">github.com/slashtechno</a><br /><a href="mailto:angad@slashtechno.com">angad@slashtechno.com</a></p>
          <p style={{ marginTop: 24, fontSize: 10, opacity: 0.6 }}>// end of scroll — thanks for visiting the city</p>
        </div>
      </CityChrome>
    </>
  );
}
