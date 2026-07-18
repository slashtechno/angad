import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router";
import * as THREE from "three";
import "../city.css";

// ── Helpers ────────────────────────────────────
function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = a; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ss = (t: number) => t * t * (3 - 2 * t);
const lerpColor = (a: THREE.Color, b: THREE.Color, t: number) =>
  new THREE.Color(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t);

// ── Time-of-day palette ────────────────────────
const palettes = {
  sky: [0x2a1f2e, 0x6b7d92, 0x6b88a8, 0x4a4a6a, 0x14182a],
  ground: [0x2a2a35, 0x3a3d4a, 0x454852, 0x353645, 0x1a1c25],
  fog: [0x3a2f3e, 0x8a9aae, 0x95a8b8, 0x6a5a7a, 0x1a1e30],
  sunCol: [0xffaa66, 0xfff0d4, 0xfff8e0, 0xff7a3d, 0x4060a0],
  sunInt: [1.2, 1.6, 1.8, 1.4, 0.3],
  ambCol: [0x4a3a55, 0x9aaabe, 0xb0c0d0, 0x6a5a80, 0x2a3040],
  ambInt: [0.4, 0.7, 0.8, 0.5, 0.2],
};
function paletteAt(p: number, key: keyof typeof palettes) {
  const arr = palettes[key], idx = p * (arr.length - 1);
  const i0 = Math.floor(idx), i1 = Math.min(arr.length - 1, i0 + 1), t = idx - i0;
  return lerpColor(new THREE.Color(arr[i0]), new THREE.Color(arr[i1]), t);
}

// ── Camera path (unused — CityTheme uses ambient drift) ──
const camPath: { pos: number[]; look: number[]; time: number }[] = [];

// ── Window texture ─────────────────────────────
function makeWindowTexture(seed: number) {
  const c = document.createElement("canvas"); c.width = 128; c.height = 256;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#0a0c12"; ctx.fillRect(0, 0, 128, 256);
  const rng = mulberry32(seed);
  for (let y = 0; y < 12; y++) for (let x = 0; x < 6; x++) {
    const r = rng();
    ctx.fillStyle = r < 0.15 ? "#ffcc66" : r < 0.3 ? "#ffaa44" : r < 0.4 ? "#66aaff" : r < 0.45 ? "#ffffff" : "#080a10";
    ctx.fillRect(x * 21.33 + 2, y * 21.33 + 2, 17.33, 17.33);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

const carColors = [0xff3030, 0x3060ff, 0xffe040, 0xffffff, 0x202020, 0xff8030];
const signColors = [0xff0080, 0x00d4ff, 0xffaa00, 0xff00ff, 0x00ff88];

// ── Three.js helpers ────────────────────────────
function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, pos: [number, number, number] = [0, 0, 0]) {
  const m = new THREE.Mesh(geo, mat); m.position.set(...pos); return m;
}
function addBuilding(city: THREE.Group, mats: THREE.MeshStandardMaterial[], x: number, z: number, w: number, h: number, d: number, matIdx: number) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const m = new THREE.Mesh(geo, mats[matIdx % mats.length]);
  m.position.set(x, h / 2, z); m.castShadow = true; m.receiveShadow = true; city.add(m);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0x6080a0, transparent: true, opacity: 0.15 }));
  edges.position.copy(m.position); city.add(edges);
  if (Math.random() > 0.5) {
    const eq = new THREE.Mesh(new THREE.BoxGeometry(w * 0.3, 0.5 + Math.random() * 0.5, d * 0.3), new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.9 }));
    eq.position.set(x + (Math.random() - 0.5) * w * 0.3, h + 0.25, z); eq.castShadow = true; city.add(eq);
  }
  if (Math.random() > 0.7) {
    city.add(mesh(new THREE.CylinderGeometry(0.05, 0.05, 2, 6), new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.8 }), [x, h + 1, z]));
    city.add(mesh(new THREE.SphereGeometry(0.1, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff2222 }), [x, h + 2, z]));
  }
}
function makeCar(city: THREE.Group, dir: number, laneX: number, startZ: number) {
  const grp = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 2.4), new THREE.MeshStandardMaterial({ color: carColors[Math.floor(Math.random() * carColors.length)], roughness: 0.4, metalness: 0.6 }));
  body.position.y = 0.45; body.castShadow = true; grp.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 1.2), new THREE.MeshStandardMaterial({ color: 0x101015, roughness: 0.3, metalness: 0.7 }));
  cabin.position.set(0, 0.9, -0.1); grp.add(cabin);
  for (const s of [-1, 1]) grp.add(mesh(new THREE.SphereGeometry(0.08, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffffe0 }), [s * 0.5, 0.5, 1.2]));
  for (const s of [-1, 1]) grp.add(mesh(new THREE.SphereGeometry(0.08, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff2020 }), [s * 0.5, 0.5, -1.2]));
  grp.position.set(laneX, 0, startZ);
  grp.userData.dir = dir; grp.userData.speed = 8 + Math.random() * 6;
  city.add(grp);
  return grp;
}

// ── Layout component ────────────────────────────
export default function CityTheme({ children }: { children: ReactNode }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [clockStr, setClockStr] = useState("--:--:--");
  const [humStr, setHumStr] = useState("— dB");
  const mouseRef = useRef({ x: 0, y: 0 });
  const location = useLocation();
  const isHome = location.pathname === "/";

  // ── Body class ────────────────────────────────
  useEffect(() => {
    document.body.classList.add("city-page");
    return () => document.body.classList.remove("city-page");
  }, []);

  // ── Mouse ────────────────────────────
  useEffect(() => {
    const onMouse = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX / window.innerWidth - 0.5;
      mouseRef.current.y = e.clientY / window.innerHeight - 0.5;
    };
    window.addEventListener("mousemove", onMouse);
    return () => window.removeEventListener("mousemove", onMouse);
  }, []);

  // ── Three.js scene ────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x1a1d24, 0.015);
    const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.set(0, 14, 50); camera.lookAt(0, 6, 0);

    // Lights
    const sun = new THREE.DirectionalLight(0xffffff, 1.0);
    sun.position.set(20, 15, 10); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 80;
    sun.shadow.camera.left = -40; sun.shadow.camera.right = 40;
    sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0x6080a0, 0.3); fill.position.set(-10, 8, -10); scene.add(fill);
    const ambient = new THREE.AmbientLight(0x404050, 0.4); scene.add(ambient);

    // Building materials
    const buildingMats = Array.from({ length: 20 }, (_, i) =>
      new THREE.MeshStandardMaterial({ map: makeWindowTexture(i * 31337), color: 0x4a4d55, roughness: 0.7, metalness: 0.0 }));

    // City group
    const city = new THREE.Group(); scene.add(city);

    // Road
    const roadGeo = new THREE.PlaneGeometry(80, 200); roadGeo.rotateX(-Math.PI / 2);
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x1a1c22, roughness: 0.9, metalness: 0.0 });
    const road = new THREE.Mesh(roadGeo, roadMat); road.position.y = 0.01; road.receiveShadow = true; city.add(road);

    // Stripes
    const stripeMat = new THREE.MeshBasicMaterial({ color: 0xd0c890 });
    for (let i = -95; i < 95; i += 3) {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 1.5), stripeMat);
      s.rotation.x = -Math.PI / 2; s.position.set(0, 0.02, i); city.add(s);
    }

    // Sidewalks
    const swMat = new THREE.MeshStandardMaterial({ color: 0x55585f, roughness: 0.85, metalness: 0.0 });
    for (const side of [-1, 1]) {
      const sw = new THREE.Mesh(new THREE.BoxGeometry(8, 0.15, 200), swMat);
      sw.position.set(side * 14, 0.075, 0); sw.receiveShadow = true; city.add(sw);
    }

    // Buildings
    const rng = mulberry32(42);
    for (const side of [-1, 1]) {
      for (let z = -90; z < 90; z += 8 + rng() * 4) {
        if (Math.abs(z) < 5) continue;
        addBuilding(city, buildingMats, side * (18 + rng() * 4), z, 4 + rng() * 3, 8 + rng() * 22, 5 + rng() * 3, Math.floor(rng() * 20));
      }
      for (let z = -90; z < 90; z += 10 + rng() * 6)
        addBuilding(city, buildingMats, side * (26 + rng() * 5), z, 5 + rng() * 4, 12 + rng() * 30, 6 + rng() * 3, Math.floor(rng() * 20));
      for (let z = -90; z < 90; z += 14 + rng() * 8)
        addBuilding(city, buildingMats, side * (38 + rng() * 4), z, 6 + rng() * 4, 25 + rng() * 35, 6 + rng() * 4, Math.floor(rng() * 20));
    }

    // Cars
    const cars: THREE.Group[] = [];
    for (let i = 0; i < 18; i++) {
      const dir = i % 2 === 0 ? 1 : -1;
      cars.push(makeCar(city, dir, dir * 3.5, -90 + Math.random() * 180));
    }

    // Streetlamps
    const lamps: { light: THREE.PointLight; mesh: THREE.Mesh }[] = [];
    for (let z = -95; z < 95; z += 12) for (const side of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 4, 6), new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 }));
      post.position.set(side * 10, 2, z); city.add(post);
      const lm = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffd089 }));
      lm.position.set(side * 10, 4, z); city.add(lm);
      if (Math.abs(z) % 36 < 12) {
        const pl = new THREE.PointLight(0xffb060, 0.4, 8, 2); pl.position.copy(lm.position); city.add(pl);
        lamps.push({ mesh: lm, light: pl });
      }
    }

    // Traffic light
    const tl = new THREE.Group();
    tl.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 5, 6), new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 }), [0, 2.5, 0]));
    tl.add(mesh(new THREE.BoxGeometry(0.4, 1.2, 0.4), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.7 }), [0.5, 5.2, 0]));
    const tRed = mesh(new THREE.SphereGeometry(0.12, 8, 8), new THREE.MeshBasicMaterial({ color: 0x550000 }), [0.5, 5.6, 0.21]);
    const tYel = mesh(new THREE.SphereGeometry(0.12, 8, 8), new THREE.MeshBasicMaterial({ color: 0x554400 }), [0.5, 5.2, 0.21]);
    const tGrn = mesh(new THREE.SphereGeometry(0.12, 8, 8), new THREE.MeshBasicMaterial({ color: 0x004400 }), [0.5, 4.8, 0.21]);
    tl.add(tRed); tl.add(tYel); tl.add(tGrn);
    tl.position.set(-10, 0, 0); tl.userData.lights = [tRed, tYel, tGrn]; city.add(tl);

    // Neon signs
    const signs: { mesh: THREE.Mesh; light: THREE.PointLight; color: number }[] = [];
    for (let i = 0; i < 12; i++) {
      const x = (Math.random() > 0.5 ? 1 : -1) * (18 + Math.random() * 8), z = -80 + i * 14 + Math.random() * 6;
      const w = 1.5 + Math.random() * 2, h = 0.6 + Math.random() * 1.2;
      const sign = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.1), new THREE.MeshBasicMaterial({ color: signColors[i % signColors.length] }));
      sign.position.set(x, 4 + Math.random() * 8, z);
      sign.userData.flicker = Math.random() * 0.3 + 0.7; sign.userData.phase = Math.random() * Math.PI * 2;
      city.add(sign);
      const spl = new THREE.PointLight(signColors[i % signColors.length], 0.6, 6, 2);
      spl.position.copy(sign.position); spl.position.x += (x > 0 ? -1 : 1) * 1; city.add(spl);
      signs.push({ mesh: sign, light: spl, color: signColors[i % signColors.length] });
    }

    // Particles
    const pCount = 600, pPos = new Float32Array(pCount * 3), pVel = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      pPos[i * 3] = (Math.random() - 0.5) * 60; pPos[i * 3 + 1] = Math.random() * 25; pPos[i * 3 + 2] = (Math.random() - 0.5) * 180;
      pVel[i * 3] = (Math.random() - 0.5) * 0.3; pVel[i * 3 + 1] = 0.1 + Math.random() * 0.3; pVel[i * 3 + 2] = (Math.random() - 0.5) * 0.2;
    }
    const pGeo = new THREE.BufferGeometry(); pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({ color: 0xffb060, size: 0.12, transparent: true, opacity: 0.8, sizeAttenuation: true, blending: THREE.AdditiveBlending });
    const particles = new THREE.Points(pGeo, pMat); scene.add(particles);

    // ── Animation loop (scroll-driven) ──────────
    const clock = new THREE.Clock(); let trafficPhase = 0, animId: number;
    function tick() {
      animId = requestAnimationFrame(tick);
      const dt = Math.min(clock.getDelta(), 0.1), t = clock.getElapsedTime();
      trafficPhase += dt;

      // Slow time-of-day cycle (~2 minutes per full cycle)
      const time = (t * 0.008) % 1;

      // Lighting
      sun.color.copy(paletteAt(time, "sunCol"));
      sun.intensity = lerp(palettes.sunInt[0], palettes.sunInt[4], time);
      sun.position.set(Math.cos(Math.PI * (0.1 + time * 0.9)) * 30, Math.sin(Math.PI * (0.1 + time * 0.9)) * 30, 10);
      ambient.color.copy(paletteAt(time, "ambCol"));
      ambient.intensity = lerp(palettes.ambInt[0], palettes.ambInt[4], time);

      const skyC = paletteAt(time, "sky"), fogC = paletteAt(time, "fog");
      scene.background = skyC; scene.fog!.color.copy(fogC); renderer.setClearColor(skyC);
      roadMat.color.copy(paletteAt(time, "ground"));

      setClockStr(`${String(Math.floor(6 + time * 18)).padStart(2, "0")}:${String(Math.floor((time * 18 * 60) % 60)).padStart(2, "0")}:${String(Math.floor(t * 60) % 60).padStart(2, "0")}`);
      setHumStr(`${(38 + Math.sin(t * 0.5) * 3 + Math.random() * 0.5).toFixed(1)} dB`);

      const dark = 1 - Math.min(1, Math.max(0, (time - 0.5) * 1.5));
      lamps.forEach(l => { l.light.intensity = 0.4 * dark; });
      signs.forEach(s => {
        const flick = Math.sin(t * 8 + s.mesh.userData.phase) * 0.1 + s.mesh.userData.flicker;
        s.light.intensity = 0.6 * dark * (0.8 + flick * 0.2);
        s.mesh.material.color.setRGB(s.color === 0xff0080 ? 0.6 * dark * flick : s.mesh.material.color.r, s.mesh.material.color.g, s.mesh.material.color.b);
      });

      // Camera (ambient drift + mouse parallax)
      const mx = mouseRef.current.x, my = mouseRef.current.y;
      camera.position.set(
        Math.sin(t * 0.12) * 6 + mx * 1.5,
        8 + Math.sin(t * 0.18) * 1.5 + my * 0.5,
        40 + Math.cos(t * 0.09) * 8);
      camera.lookAt(Math.sin(t * 0.1) * 3, 5, Math.cos(t * 0.07) * 3);

      // Cars
      cars.forEach(c => { c.position.z += c.userData.dir * c.userData.speed * dt; if (Math.abs(c.position.z) > 100) c.position.z = -c.position.z; });

      // Traffic light
      const cycle = Math.floor(trafficPhase * 0.4) % 3;
      const tls = tl.userData.lights as THREE.Mesh[];
      (tls[0].material as THREE.MeshBasicMaterial).color.setHex(cycle === 0 ? 0xff2020 : 0x330000);
      (tls[1].material as THREE.MeshBasicMaterial).color.setHex(cycle === 1 ? 0xffcc00 : 0x332200);
      (tls[2].material as THREE.MeshBasicMaterial).color.setHex(cycle === 2 ? 0x00ff44 : 0x003300);

      // Particles
      const pp = particles.geometry.attributes.position;
      for (let i = 0; i < pp.count; i++) {
        pp.setX(i, pp.getX(i) + pVel[i * 3] * dt + Math.sin(t * 0.3 + i) * 0.005);
        pp.setY(i, pp.getY(i) + pVel[i * 3 + 1] * dt);
        pp.setZ(i, pp.getZ(i) + pVel[i * 3 + 2] * dt);
        if (pp.getY(i) > 28) { pp.setY(i, 0); pp.setX(i, (Math.random() - 0.5) * 60); pp.setZ(i, (Math.random() - 0.5) * 180 + camera.position.z); }
      }
      pp.needsUpdate = true;
      pMat.color.copy(new THREE.Color().lerpColors(new THREE.Color(0xffd089), new THREE.Color(0x60a0ff), time));
      pMat.opacity = 0.4 + dark * 0.5;
      renderer.render(scene, camera);
    }
    tick();

    const onResize = () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight); };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(animId); window.removeEventListener("resize", onResize);
      renderer.dispose();
      scene.traverse(obj => { if (obj instanceof THREE.Mesh) { obj.geometry.dispose(); (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach(m => m.dispose()); } });
      buildingMats.forEach(m => { m.map?.dispose(); m.dispose(); });
    };
  }, []);

  return (
    <>
      <canvas ref={canvasRef} className="city-canvas" />
      <div className="city-vignette" />
      <div className="city-grain" />

      {/* Top-left UI */}
      <div className="city-ui city-ui-tl">
        <div className="city-logo">ANGAD</div>
        <div className="city-logo-sub">// field notes</div>
        <div className="city-copy"><span>© 2026</span><span>slashtechno</span></div>
        {!isHome && (
          <Link to="/" className="city-back">← back home</Link>
        )}

      </div>

      {/* Top-right UI */}
      <div className="city-ui city-ui-tr">
        <div className="city-manifesto-tag">//// Now</div>
        <div className="city-manifesto-title">Tending the garden</div>
        <div className="city-manifesto-text">Writing, building side projects, learning new things.</div>
      </div>

      {/* Ambient readout */}
      <div className="city-ambient">
        <div className="row"><span className="label">local</span><span>{clockStr}</span></div>
        <div className="row"><span className="label">signal</span><span className="city-blink">● live</span></div>
        <div className="row"><span className="label">lat/lng</span><span>37.7749° N, 122.4194° W</span></div>
        <div className="row"><span className="label">hum</span><span>{humStr}</span></div>
      </div>

      {/* Content area — transparent, content floats in 3D space */}
      <div className="city-content">
        {children}
      </div>
    </>
  );
}
