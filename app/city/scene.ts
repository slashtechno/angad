import * as THREE from "three";

// ── Helpers ────────────────────────────────────
export function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = a; t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const ss = (t: number) => t * t * (3 - 2 * t);
export const lerpColor = (a: THREE.Color, b: THREE.Color, t: number) =>
  new THREE.Color(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t);

// ── Time-of-day palette ────────────────────────
export const palettes = {
  sky: [0x4a3a5e, 0x9aaabe, 0xb0c0d0, 0x8a7a9a, 0x3a3a5e],
  ground: [0x3a3a45, 0x4a4d5a, 0x555862, 0x454655, 0x2a2c35],
  fog: [0x5a4f5e, 0x9aaabe, 0xa5b8c8, 0x7a6a8a, 0x3a3e50],
  sunCol: [0xffaa66, 0xffe0b4, 0xfff8e0, 0xff8a4d, 0x8060a0],
  sunInt: [1.6, 2.0, 2.4, 1.8, 0.7],
  ambCol: [0x6a5a75, 0xaaBabe, 0xc0d0e0, 0x8a7aA0, 0x5a5060],
  ambInt: [0.6, 1.0, 1.2, 0.8, 0.4],
};
export function paletteAt(p: number, key: keyof typeof palettes) {
  const arr = palettes[key], idx = p * (arr.length - 1);
  const i0 = Math.floor(idx), i1 = Math.min(arr.length - 1, i0 + 1), t = idx - i0;
  return lerpColor(new THREE.Color(arr[i0]), new THREE.Color(arr[i1]), t);
}

// ── Window texture ─────────────────────────────
export function makeWindowTexture(seed: number) {
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

// ── Constants ──────────────────────────────────
export const carColors = [0xff3030, 0x3060ff, 0xffe040, 0xffffff, 0x202020, 0xff8030];
export const signColors = [0xff0080, 0x00d4ff, 0xffaa00, 0xff00ff, 0x00ff88];

// ── Three.js helpers ────────────────────────────
export function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, pos: [number, number, number] = [0, 0, 0]) {
  const m = new THREE.Mesh(geo, mat); m.position.set(...pos); return m;
}

// ── Roof equipment (water tanks, antennas, AC units) ──
export function addRoofEquipment(city: THREE.Group, x: number, h: number, z: number, w: number, d: number, rng: () => number) {
  const roll = rng();
  if (roll < 0.3) {
    // Water tower
    const tank = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 0.8, 1.2, 8),
      new THREE.MeshStandardMaterial({ color: 0x3a3a3e, roughness: 0.8, metalness: 0.2 })
    );
    tank.position.set(x + (rng() - 0.5) * w * 0.3, h + 0.6, z + (rng() - 0.5) * d * 0.3);
    city.add(tank);
    const legs = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.6, 4),
      new THREE.MeshStandardMaterial({ color: 0x222222 })
    );
    legs.position.copy(tank.position); legs.position.y -= 0.9;
    city.add(legs);
  } else if (roll < 0.5) {
    // Antenna array
    const ant = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 3 + rng() * 2, 4),
      new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.6, metalness: 0.4 })
    );
    ant.position.set(x + (rng() - 0.5) * w * 0.3, h + 1.5 + rng(), z);
    city.add(ant);
    // Blinking red light on antenna
    const blink = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xff2222 })
    );
    blink.position.copy(ant.position); blink.position.y += 1.5 + rng();
    blink.userData.blink = true;
    city.add(blink);
  } else if (roll < 0.7) {
    // AC unit cluster
    for (let i = 0; i < 2 + Math.floor(rng() * 3); i++) {
      const unit = new THREE.Mesh(
        new THREE.BoxGeometry(0.8 + rng() * 0.4, 0.4, 0.6 + rng() * 0.3),
        new THREE.MeshStandardMaterial({ color: 0x4a4a4e, roughness: 0.9 })
      );
      unit.position.set(
        x + (rng() - 0.5) * w * 0.4,
        h + 0.2,
        z + (rng() - 0.5) * d * 0.4
      );
      city.add(unit);
    }
  } else if (roll < 0.85) {
    // Rooftop sign / logo block — use BasicMaterial so it glows regardless of lighting
    const signColor = [0xff4060, 0x40a0ff, 0xffa040, 0x40ff90][Math.floor(rng() * 4)];
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.4, 0.8, 0.2),
      new THREE.MeshBasicMaterial({ color: signColor })
    );
    sign.position.set(x, h + 0.4, z + d / 2 + 0.1);
    city.add(sign);
  }
}

// ── Building ────────────────────────────────────
export function addBuilding(city: THREE.Group, mats: THREE.MeshStandardMaterial[], x: number, z: number, w: number, h: number, d: number, matIdx: number, rng: () => number) {
  const style = rng();
  const mat = mats[matIdx % mats.length];

  if (style < 0.25) {
    // Setback tower — multiple stacked boxes shrinking upward
    const tiers = 2 + Math.floor(rng() * 3);
    let curY = 0, curW = w, curD = d;
    for (let i = 0; i < tiers; i++) {
      const tierH = h / tiers * (0.8 + rng() * 0.4);
      const geo = new THREE.BoxGeometry(curW, tierH, curD);
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, curY + tierH / 2, z);
      m.castShadow = true; m.receiveShadow = true;
      city.add(m);
      curY += tierH;
      curW *= 0.7 + rng() * 0.15;
      curD *= 0.7 + rng() * 0.15;
    }
    addRoofEquipment(city, x, curY, z, curW, curD, rng);
  } else if (style < 0.4) {
    // Cylindrical tower
    const radius = Math.min(w, d) / 2;
    const geo = new THREE.CylinderGeometry(radius, radius * 1.1, h, 12);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, h / 2, z);
    m.castShadow = true; m.receiveShadow = true;
    city.add(m);
    addRoofEquipment(city, x, h, z, w, d, rng);
  } else if (style < 0.55) {
    // Pyramidal roof — box + cone
    const roofH = h * 0.25;
    const bodyH = h - roofH;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, bodyH, d), mat);
    body.position.set(x, bodyH / 2, z);
    body.castShadow = true; body.receiveShadow = true;
    city.add(body);
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(Math.max(w, d) * 0.7, roofH, 4),
      new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.8 })
    );
    roof.position.set(x, bodyH + roofH / 2, z);
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    city.add(roof);
  } else {
    // Standard box with edge wireframe
    const geo = new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, h / 2, z);
    m.castShadow = true; m.receiveShadow = true;
    city.add(m);
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color: 0x6080a0, transparent: true, opacity: 0.15 })
    );
    edges.position.copy(m.position);
    city.add(edges);
    addRoofEquipment(city, x, h, z, w, d, rng);
  }
}

// ── Car ────────────────────────────────────────
export function makeCar(city: THREE.Group, dir: number, laneX: number, startZ: number) {
  const grp = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, 2.4), new THREE.MeshStandardMaterial({ color: carColors[Math.floor(Math.random() * carColors.length)], roughness: 0.4, metalness: 0.6 }));
  body.position.y = 0.45; grp.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 1.2), new THREE.MeshStandardMaterial({ color: 0x101015, roughness: 0.3, metalness: 0.7 }));
  cabin.position.set(0, 0.9, -0.1); grp.add(cabin);
  for (const s of [-1, 1]) grp.add(mesh(new THREE.SphereGeometry(0.08, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffffe0 }), [s * 0.5, 0.5, 1.2]));
  for (const s of [-1, 1]) grp.add(mesh(new THREE.SphereGeometry(0.08, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff2020 }), [s * 0.5, 0.5, -1.2]));
  grp.position.set(laneX, 0, startZ);
  if (dir < 0) grp.rotation.y = Math.PI; // face -z so headlights lead, tail lights trail
  grp.userData.dir = dir; grp.userData.speed = 8 + Math.random() * 6;
  city.add(grp);
  return grp;
}

// ── City handles ──────────────────────────────
export interface CityHandles {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  lamps: { light: THREE.PointLight; mesh: THREE.Mesh }[];
  signs: { mesh: THREE.Mesh; light: THREE.PointLight | null; color: number }[];
  cars: THREE.Group[];
  trafficLights: { group: THREE.Group; lights: THREE.Mesh[]; z: number; phase: number }[];
  buildingMats: THREE.MeshStandardMaterial[];
  sun: THREE.DirectionalLight;
  ambient: THREE.AmbientLight;
  roadMat: THREE.MeshStandardMaterial;
}

export interface CityOptions {
  canvas: HTMLCanvasElement;
  fog?: number;
  initialCameraPos?: [number, number, number];
  initialCameraLook?: [number, number, number];
  pixelRatio?: number;
  antialias?: boolean;
  shadowsEnabled?: boolean;
  shadowMapSize?: number;
}

// ── Scene builder ──────────────────────────────
export function createCity(opts: CityOptions): CityHandles {
  const {
    canvas,
    fog = 0.015,
    initialCameraPos = [0, 14, 50],
    initialCameraLook = [0, 6, 0],
    pixelRatio = Math.min(devicePixelRatio, 1.5),
    antialias = true,
    shadowsEnabled = true,
    shadowMapSize = 1024,
  } = opts;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias, alpha: false });
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = shadowsEnabled;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x1a1d24, fog);
  const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
  camera.position.set(...initialCameraPos);
  camera.lookAt(...initialCameraLook);

  // Lights
  const sun = new THREE.DirectionalLight(0xffffff, 1.0);
  sun.position.set(20, 15, 10); sun.castShadow = true;
  sun.shadow.mapSize.set(shadowMapSize, shadowMapSize);
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
  const stripeMat = new THREE.MeshBasicMaterial({ color: 0xfcc419 }); // yellow center line (US-style opposing-traffic divider)
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
      addBuilding(city, buildingMats, side * (18 + rng() * 4), z, 4 + rng() * 3, 8 + rng() * 22, 5 + rng() * 3, Math.floor(rng() * 20), rng);
    }
    for (let z = -90; z < 90; z += 10 + rng() * 6)
      addBuilding(city, buildingMats, side * (26 + rng() * 5), z, 5 + rng() * 4, 12 + rng() * 30, 6 + rng() * 3, Math.floor(rng() * 20), rng);
    for (let z = -90; z < 90; z += 14 + rng() * 8)
      addBuilding(city, buildingMats, side * (38 + rng() * 4), z, 6 + rng() * 4, 25 + rng() * 35, 6 + rng() * 4, Math.floor(rng() * 20), rng);
  }

  // Cars
  const cars: THREE.Group[] = [];
  for (let i = 0; i < 8; i++) {
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
    // Only add a real point light every other lamp (keep count low)
    if (Math.abs(z) % 24 < 12) {
      const pl = new THREE.PointLight(0xffb060, 0.4, 8, 2); pl.position.copy(lm.position); city.add(pl);
      lamps.push({ mesh: lm, light: pl });
    }
  }

  // Traffic lights — 3 along the main road, each with a phase offset
  const trafficLights: { group: THREE.Group; lights: THREE.Mesh[]; z: number; phase: number }[] = [];
  const lightZPositions = [-30, 0, 30];
  for (let i = 0; i < lightZPositions.length; i++) {
    const lz = lightZPositions[i];
    const tl = new THREE.Group();
    tl.add(mesh(new THREE.CylinderGeometry(0.08, 0.08, 5, 6), new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 }), [0, 2.5, 0]));
    tl.add(mesh(new THREE.BoxGeometry(0.4, 1.2, 0.4), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.7 }), [0.5, 5.2, 0]));
    const tRed = mesh(new THREE.SphereGeometry(0.12, 8, 8), new THREE.MeshBasicMaterial({ color: 0x550000 }), [0.5, 5.6, 0.21]);
    const tYel = mesh(new THREE.SphereGeometry(0.12, 8, 8), new THREE.MeshBasicMaterial({ color: 0x554400 }), [0.5, 5.2, 0.21]);
    const tGrn = mesh(new THREE.SphereGeometry(0.12, 8, 8), new THREE.MeshBasicMaterial({ color: 0x004400 }), [0.5, 4.8, 0.21]);
    tl.add(tRed); tl.add(tYel); tl.add(tGrn);
    tl.position.set(-10, 0, lz); city.add(tl);
    // Phase offset so lights aren't all in sync (creates traffic flow)
    trafficLights.push({ group: tl, lights: [tRed, tYel, tGrn], z: lz, phase: i * 1.3 });
  }

  // Neon signs
  const signs: { mesh: THREE.Mesh; light: THREE.PointLight | null; color: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const x = (Math.random() > 0.5 ? 1 : -1) * (18 + Math.random() * 8), z = -80 + i * 14 + Math.random() * 6;
    const w = 1.5 + Math.random() * 2, h = 0.6 + Math.random() * 1.2;
    const sign = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.1), new THREE.MeshBasicMaterial({ color: signColors[i % signColors.length] }));
    sign.position.set(x, 4 + Math.random() * 8, z);
    sign.userData.flicker = Math.random() * 0.3 + 0.7; sign.userData.phase = Math.random() * Math.PI * 2;
    city.add(sign);
    // Only add point light for every other sign to keep light count low
    if (i % 2 === 0) {
      const spl = new THREE.PointLight(signColors[i % signColors.length], 0.6, 6, 2);
      spl.position.copy(sign.position); spl.position.x += (x > 0 ? -1 : 1) * 1; city.add(spl);
      signs.push({ mesh: sign, light: spl, color: signColors[i % signColors.length] });
    } else {
      signs.push({ mesh: sign, light: null, color: signColors[i % signColors.length] });
    }
  }

  return {
    scene, camera, renderer,
    lamps, signs, cars,
    trafficLights,
    buildingMats, sun, ambient, roadMat,
  };
}

// ── Per-frame update ──────────────────────────
export function tickCity(handles: CityHandles, t: number, dt: number, trafficPhase: number, time: number, trafficEnabled = true): { dark: number } {
  const { sun, ambient, scene, renderer, roadMat, lamps, signs, cars, trafficLights } = handles;

  // Lighting
  sun.color.copy(paletteAt(time, "sunCol"));
  sun.intensity = lerp(palettes.sunInt[0], palettes.sunInt[4], time);
  sun.position.set(Math.cos(Math.PI * (0.1 + time * 0.9)) * 30, Math.sin(Math.PI * (0.1 + time * 0.9)) * 30, 10);
  ambient.color.copy(paletteAt(time, "ambCol"));
  ambient.intensity = lerp(palettes.ambInt[0], palettes.ambInt[4], time);

  const skyC = paletteAt(time, "sky"), fogC = paletteAt(time, "fog");
  scene.background = skyC; scene.fog!.color.copy(fogC); renderer.setClearColor(skyC);
  roadMat.color.copy(paletteAt(time, "ground"));

  const dark = 1 - Math.min(1, Math.max(0, (time - 0.5) * 1.5));

  // Lamps
  lamps.forEach(l => { l.light.intensity = 0.4 * dark; });

  // Signs
  signs.forEach(s => {
    const flick = Math.sin(t * 8 + s.mesh.userData.phase) * 0.1 + s.mesh.userData.flicker;
    if (s.light) s.light.intensity = 0.6 * dark * (0.8 + flick * 0.2);
    const m = s.mesh.material as THREE.MeshBasicMaterial;
    const baseR = ((s.color >> 16) & 0xff) / 255;
    const baseG = ((s.color >> 8) & 0xff) / 255;
    const baseB = (s.color & 0xff) / 255;
    const k = dark * (0.7 + flick * 0.3);
    m.color.setRGB(baseR * k, baseG * k, baseB * k);
  });

  // Traffic lights — when disabled, all stay green (cars always go)
  for (const tl of trafficLights) {
    if (!trafficEnabled) {
      (tl.lights[0].material as THREE.MeshBasicMaterial).color.setHex(0x330000);
      (tl.lights[1].material as THREE.MeshBasicMaterial).color.setHex(0x332200);
      (tl.lights[2].material as THREE.MeshBasicMaterial).color.setHex(0x00ff44);
      continue;
    }
    const localPhase = trafficPhase * 0.3 + tl.phase;
    const cycle = Math.floor(localPhase) % 3;
    (tl.lights[0].material as THREE.MeshBasicMaterial).color.setHex(cycle === 0 ? 0xff2020 : 0x330000);
    (tl.lights[1].material as THREE.MeshBasicMaterial).color.setHex(cycle === 1 ? 0xffcc00 : 0x332200);
    (tl.lights[2].material as THREE.MeshBasicMaterial).color.setHex(cycle === 2 ? 0x00ff44 : 0x003300);
  }

  // Cars — move and obey traffic lights
  const STOP_DIST = 4; // units before light where cars start braking
  cars.forEach(c => {
    const dir = c.userData.dir;
    const maxSpeed = c.userData.speed;
    // Find the nearest light ahead of this car (in its direction of travel)
    let targetSpeed = maxSpeed;
    for (const tl of trafficLights) {
      const dz = tl.z - c.position.z;
      // Is the light ahead of us in our direction?
      if (dir > 0 && dz > 0 && dz < STOP_DIST + 2) {
        // Car going +z, light is ahead
        const localPhase = trafficPhase * 0.3 + tl.phase;
        const cycle = Math.floor(localPhase) % 3;
        if (cycle === 0) { // Red — stop
          // Brake harder the closer we are
          const brake = Math.max(0, 1 - dz / (STOP_DIST + 2));
          targetSpeed = Math.min(targetSpeed, maxSpeed * (1 - brake));
        } else if (cycle === 1) { // Yellow — slow down
          targetSpeed = Math.min(targetSpeed, maxSpeed * 0.3);
        }
        // Green (cycle === 2) — go at full speed
      } else if (dir < 0 && dz < 0 && dz > -(STOP_DIST + 2)) {
        // Car going -z, light is ahead (negative dz)
        const dist = -dz;
        const localPhase = trafficPhase * 0.3 + tl.phase;
        const cycle = Math.floor(localPhase) % 3;
        if (cycle === 0) {
          const brake = Math.max(0, 1 - dist / (STOP_DIST + 2));
          targetSpeed = Math.min(targetSpeed, maxSpeed * (1 - brake));
        } else if (cycle === 1) {
          targetSpeed = Math.min(targetSpeed, maxSpeed * 0.3);
        }
      }
    }
    // Smoothly approach target speed (simulate acceleration/deceleration)
    c.userData.currentSpeed = c.userData.currentSpeed ?? maxSpeed;
    c.userData.currentSpeed = lerp(c.userData.currentSpeed, targetSpeed, dt * 4);
    c.position.z += dir * c.userData.currentSpeed * dt;
    if (Math.abs(c.position.z) > 100) c.position.z = -c.position.z;
  });

  return { dark };
}

// ── Cleanup ────────────────────────────────────
export function disposeCity(handles: CityHandles): void {
  const { renderer, scene, buildingMats } = handles;
  renderer.dispose();
  scene.traverse(obj => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      (Array.isArray(obj.material) ? obj.material : [obj.material]).forEach(m => m.dispose());
    }
  });
  buildingMats.forEach(m => { m.map?.dispose(); m.dispose(); });
}
