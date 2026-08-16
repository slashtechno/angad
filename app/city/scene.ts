import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

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
// A car's `position` is its center, but every stop-line/follow-distance calculation cares about
// where its BUMPER is — without this, "stop at the line" and "leave one car length of gap" were
// both silently measuring from the center, so cars actually stopped/queued half a car length past
// where they looked like they should.
export const CAR_LENGTH = 2.4;
export const CAR_HALF_LENGTH = CAR_LENGTH / 2;

// ── Intersection geometry ───────────────────────
// The one real intersection's layout, defined once and shared between scene construction
// (createCity, below) and the simulation (tickCity, further down) — crosswalk stripes, stop
// lines, and pedestrian walk paths all derive from these same numbers, so they can't quietly
// drift out of alignment with each other the way independently hand-picked literals would.
export const INTERSECTION_HALF = 4; // half-width of the cross street's paved opening
export const MAIN_SIDEWALK_INNER = 10; // inner (curb) edge of the main road's sidewalks — also where the NS crosswalk and NS pedestrian crossing both span to
export const EW_LANE = 2; // cross-street lane offset (z), within the ±INTERSECTION_HALF pavement
export const SIDEWALK_WIDTH = 8; // both sidewalk networks are this wide (perpendicular to their road)
export const MAIN_SIDEWALK_X = 14; // main road sidewalks, centered here on either side
export const CROSS_SIDEWALK_Z = INTERSECTION_HALF + 4; // cross-street sidewalks, centered here on either side
export const CROSS_SIDEWALK_FAR = 30; // far (outer) end of the cross-street sidewalks
// The main sidewalk's outer (far-from-road) edge — where it stops and the cross-street sidewalk
// can safely start without the two boxes overlapping at the corner (both networks are wide enough,
// and start close enough to the intersection, that starting the cross-street one at
// MAIN_SIDEWALK_INNER instead would double-cover the same square of ground the main sidewalk
// already covers).
export const MAIN_SIDEWALK_OUTER = MAIN_SIDEWALK_X + SIDEWALK_WIDTH / 2;
// The cross street is a full road (80 units long, see createCity) — MAIN_SIDEWALK_INNER only marks
// where the MAIN road's own pavement ends, not where the EW crosswalk has to sit. Anchoring it there
// crowded it right up against the NS crosswalk/stop-line cluster at the intersection's center.
// MAIN_SIDEWALK_X — the main sidewalk's own centerline, a real landmark already used elsewhere, not
// a new arbitrary offset — reads as "further out, no longer huddled at the corner" while still
// landing on paved ground the whole way (main sidewalk through MAIN_SIDEWALK_OUTER, then the
// cross-street sidewalk beyond it).
export const EW_CROSSWALK_X = MAIN_SIDEWALK_X;
export const CROSSWALK_HALF_LEN = 1.2; // half-length of a crosswalk's zebra-stripe field, across the road it crosses
export const CROSSWALK_BAR_HALF_WIDTH = 0.35; // half-width of an individual zebra-stripe bar, along the direction bars are spread — a bar isn't an infinitely thin line, so this counts toward how far the stripe FIELD actually reaches
const CROSSWALK_EDGE_MARGIN = 0.3;
// How far each crosswalk's stripe field (and the pedestrian path walking it — see updateCrossers)
// reaches from the road's centerline — each simply reaches its own sidewalk with a small paint
// margin. This is safe from the two crosswalks' stripe fields overlapping (they're real rectangles,
// not infinitely thin lines) only because EW_CROSSWALK_X sits well clear of NS_CROSSWALK_SPAN's
// reach (MAIN_SIDEWALK_INNER) — by more than a crosswalk's own half-length plus a bar's half-width,
// with room to spare. If EW_CROSSWALK_X ever moves back near MAIN_SIDEWALK_INNER, that clearance
// needs re-deriving (see the git history around this comment for the version that did that math).
export const NS_CROSSWALK_SPAN = MAIN_SIDEWALK_INNER - CROSSWALK_EDGE_MARGIN;
export const EW_CROSSWALK_SPAN = INTERSECTION_HALF - CROSSWALK_EDGE_MARGIN;
export const STOP_OFFSET = INTERSECTION_HALF + 2.6; // clears the NS crosswalk band (INTERSECTION_HALF ± CROSSWALK_HALF_LEN) with a buffer, so cars stop short of it, not on it
export const EW_STOP_OFFSET = EW_CROSSWALK_X + 2.6; // clears the EW crosswalk band the same way STOP_OFFSET clears the NS one

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
// `axis` is which world axis the car travels along ("z" for the main road, "x" for the cross
// street). `laneOffset` is the car's fixed coordinate on the OTHER axis, `startPos` its starting
// coordinate on the travel axis. The model is built facing +z; for axis "x" it's rotated an extra
// 90° so "forward" (headlights leading) points along +x/-x instead.
export function makeCar(city: THREE.Group, dir: 1 | -1, laneOffset: number, startPos: number, axis: "x" | "z" = "z") {
  const grp = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, CAR_LENGTH), new THREE.MeshStandardMaterial({ color: carColors[Math.floor(Math.random() * carColors.length)], roughness: 0.4, metalness: 0.6 }));
  body.position.y = 0.45; grp.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 1.2), new THREE.MeshStandardMaterial({ color: 0x101015, roughness: 0.3, metalness: 0.7 }));
  cabin.position.set(0, 0.9, -0.1); grp.add(cabin);
  for (const s of [-1, 1]) grp.add(mesh(new THREE.SphereGeometry(0.08, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffffe0 }), [s * 0.5, 0.5, 1.2]));
  for (const s of [-1, 1]) grp.add(mesh(new THREE.SphereGeometry(0.08, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff2020 }), [s * 0.5, 0.5, -1.2]));

  if (axis === "z") {
    grp.position.set(laneOffset, 0, startPos);
    if (dir < 0) grp.rotation.y = Math.PI; // face -z so headlights lead, tail lights trail
  } else {
    grp.position.set(startPos, 0, laneOffset);
    grp.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2; // face +x or -x
  }
  grp.userData.dir = dir; grp.userData.axis = axis; grp.userData.speed = 8 + Math.random() * 6;
  // Per-car following gap, jittered around CAR_MIN_GAP — without this every car in a queue settles
  // at the exact same spacing, which reads as mechanically uniform rather than like actual traffic.
  grp.userData.followGap = CAR_MIN_GAP + Math.random() * 1.2;
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
  trafficLights: { lights: THREE.Mesh[]; axis: "x" | "z"; pos: number; dir: 1 | -1 }[];
  walkSigns: THREE.Mesh[];
  crossWalkSigns: THREE.Mesh[];
  crossers: { grp: THREE.Group; fixed: number; axis: "x" | "z"; gated: boolean; t: number; dir: 1 | -1; moving: boolean; graduated: boolean; strollDir: 1 | -1; strollSpeed: number }[];
  strollers: { grp: THREE.Group; axis: "x" | "z"; dir: 1 | -1; speed: number }[];
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

  // Sidewalks (main N-S road) — split fore/aft of the intersection so the cross street has a curb cut
  const swMat = new THREE.MeshStandardMaterial({ color: 0x55585f, roughness: 0.85, metalness: 0.0 });

  // Stripes, stop lines, and crosswalk zebra bars are all static ground decals that never move or
  // change independently once placed — dozens of separate Meshes for them is dozens of draw calls
  // for no visual benefit over one merged mesh per material. Each loop below builds pre-transformed
  // (rotated + translated into final position) geometries and merges them at the end instead of
  // creating a Mesh per bar.
  const stripeGeos: THREE.BufferGeometry[] = [];
  for (let i = -95; i < 95; i += 3) {
    if (Math.abs(i) < INTERSECTION_HALF + 1) continue;
    const g = new THREE.PlaneGeometry(0.15, 1.5);
    g.rotateX(-Math.PI / 2); g.translate(0, 0.02, i);
    stripeGeos.push(g);
  }
  for (const side of [-1, 1]) {
    for (const [zStart, zEnd] of [[-100, -INTERSECTION_HALF], [INTERSECTION_HALF, 100]]) {
      const len = zEnd - zStart;
      const sw = new THREE.Mesh(new THREE.BoxGeometry(SIDEWALK_WIDTH, 0.15, len), swMat);
      sw.position.set(side * MAIN_SIDEWALK_X, 0.075, zStart + len / 2); sw.receiveShadow = true; city.add(sw);
    }
  }

  // Cross street — a single perpendicular road through the one intersection
  const crossRoadGeo = new THREE.PlaneGeometry(80, INTERSECTION_HALF * 2); crossRoadGeo.rotateX(-Math.PI / 2);
  const crossRoad = new THREE.Mesh(crossRoadGeo, roadMat); crossRoad.position.y = 0.012; crossRoad.receiveShadow = true; city.add(crossRoad);
  for (let i = -35; i < 35; i += 3) {
    if (Math.abs(i) < EW_CROSSWALK_X + CROSSWALK_HALF_LEN + 1) continue; // stop clear of the main road AND the EW crosswalk band; the EW crosswalk sits further out than the main road, so clearing it subsumes clearing the main road too
    const g = new THREE.PlaneGeometry(1.5, 0.15);
    g.rotateX(-Math.PI / 2); g.translate(i, 0.02, 0);
    stripeGeos.push(g);
  }
  const stripeMat = new THREE.MeshBasicMaterial({ color: 0xfcc419 }); // yellow center line (US-style opposing-traffic divider)
  city.add(new THREE.Mesh(mergeGeometries(stripeGeos), stripeMat));

  // Stop lines and crosswalk zebra bars — solid/striped white-ish markings, all one material, so
  // they're collected into one merged geometry (roadMarkingGeos) and added as a single mesh below.
  const roadMarkingMat = new THREE.MeshBasicMaterial({ color: 0xd8dae0 });
  const roadMarkingGeos: THREE.BufferGeometry[] = [];

  // Stop lines — solid bars just before each crosswalk, edge-to-edge across the road, where cars
  // actually stop. Both roads get one: the main road (spanning its full sidewalk-to-sidewalk
  // width) and the cross street (spanning its own, narrower, pavement width).
  for (const z of [-STOP_OFFSET, STOP_OFFSET]) {
    const g = new THREE.PlaneGeometry(MAIN_SIDEWALK_INNER * 2, 0.35);
    g.rotateX(-Math.PI / 2); g.translate(0, 0.021, z);
    roadMarkingGeos.push(g);
  }
  for (const x of [-EW_STOP_OFFSET, EW_STOP_OFFSET]) {
    const g = new THREE.PlaneGeometry(0.35, INTERSECTION_HALF * 2);
    g.rotateX(-Math.PI / 2); g.translate(x, 0.021, 0);
    roadMarkingGeos.push(g);
  }

  // Cross-street sidewalks — perpendicular sidewalks either side of the cross street, near the
  // corner. Start at MAIN_SIDEWALK_OUTER, not MAIN_SIDEWALK_INNER: the main sidewalk already
  // covers the corner square between the two roads (it runs the full width of both), so starting
  // here instead of at the road's near edge would double-cover that square with two overlapping
  // boxes instead of meeting it edge-to-edge.
  for (const side of [-1, 1]) {
    for (const [xStart, xEnd] of [[-CROSS_SIDEWALK_FAR, -MAIN_SIDEWALK_OUTER], [MAIN_SIDEWALK_OUTER, CROSS_SIDEWALK_FAR]]) {
      const len = xEnd - xStart;
      const sw = new THREE.Mesh(new THREE.BoxGeometry(len, 0.15, SIDEWALK_WIDTH), swMat);
      sw.position.set(xStart + len / 2, 0.075, side * CROSS_SIDEWALK_Z); sw.receiveShadow = true; city.add(sw);
    }
  }

  // Crosswalks — all four sides of the intersection, each connecting adjacent sidewalk segments.
  // Bars span ±NS_CROSSWALK_SPAN / ±EW_CROSSWALK_SPAN — the SAME extents updateCrossers (in
  // tickCity) walks pedestrians across, so the stripes and the footpath can't drift apart the way
  // independently-picked numbers would (which is exactly how they drifted apart before).
  const crosswalkBarStride = 1.6;
  const addCrosswalkNS = (z: number) => { // crosses the main road; rungs run along z, spread across x
    for (let x = -NS_CROSSWALK_SPAN; x <= NS_CROSSWALK_SPAN; x += crosswalkBarStride) {
      const g = new THREE.PlaneGeometry(CROSSWALK_BAR_HALF_WIDTH * 2, CROSSWALK_HALF_LEN * 2);
      g.rotateX(-Math.PI / 2); g.translate(x, 0.022, z);
      roadMarkingGeos.push(g);
    }
  };
  const addCrosswalkEW = (x: number) => { // crosses the cross street; rungs run along x, spread across z
    for (let z = -EW_CROSSWALK_SPAN; z <= EW_CROSSWALK_SPAN; z += crosswalkBarStride) {
      const g = new THREE.PlaneGeometry(CROSSWALK_HALF_LEN * 2, CROSSWALK_BAR_HALF_WIDTH * 2);
      g.rotateX(-Math.PI / 2); g.translate(x, 0.022, z);
      roadMarkingGeos.push(g);
    }
  };
  addCrosswalkNS(-INTERSECTION_HALF);
  addCrosswalkNS(INTERSECTION_HALF);
  addCrosswalkEW(-EW_CROSSWALK_X);
  addCrosswalkEW(EW_CROSSWALK_X);
  city.add(new THREE.Mesh(mergeGeometries(roadMarkingGeos), roadMarkingMat));

  // Buildings — all rows leave a gap at the cross street opening
  const rng = mulberry32(42);
  // Clear the cross-street sidewalks (which reach to z = ±(INTERSECTION_HALF + 8))
  const BUILDING_GAP = INTERSECTION_HALF + 8;
  for (const side of [-1, 1]) {
    for (let z = -90; z < 90; z += 8 + rng() * 4) {
      if (Math.abs(z) < BUILDING_GAP) continue;
      addBuilding(city, buildingMats, side * (18 + rng() * 4), z, 4 + rng() * 3, 8 + rng() * 22, 5 + rng() * 3, Math.floor(rng() * 20), rng);
    }
    for (let z = -90; z < 90; z += 10 + rng() * 6) {
      if (Math.abs(z) < BUILDING_GAP) continue;
      addBuilding(city, buildingMats, side * (26 + rng() * 5), z, 5 + rng() * 4, 12 + rng() * 30, 6 + rng() * 3, Math.floor(rng() * 20), rng);
    }
    for (let z = -90; z < 90; z += 14 + rng() * 8) {
      if (Math.abs(z) < BUILDING_GAP) continue;
      addBuilding(city, buildingMats, side * (38 + rng() * 4), z, 6 + rng() * 4, 25 + rng() * 35, 6 + rng() * 4, Math.floor(rng() * 20), rng);
    }
  }

  // Cars — main road (NS) plus a smaller flow on the cross street (EW)
  const cars: THREE.Group[] = [];
  for (let i = 0; i < 8; i++) {
    const dir = i % 2 === 0 ? 1 : -1;
    cars.push(makeCar(city, dir, dir * 3.5, -90 + Math.random() * 180, "z"));
  }
  for (let i = 0; i < 4; i++) {
    const dir = i % 2 === 0 ? 1 : -1;
    cars.push(makeCar(city, dir, dir > 0 ? -EW_LANE : EW_LANE, -35 + Math.random() * 70, "x"));
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

  // Traffic signal — a curbside pole with a mast arm reaching over the lane it controls (the arm's
  // length is computed per instance so it actually spans pole-to-head, nothing floats), single-faced,
  // lens toward approaching traffic. A pedestrian signal box rides the same pole, near the crosswalk.
  // Works for either road: `axis` is the road's travel axis, `fixedPos` is the stop-line coordinate
  // along it, and `curbAcross`/`laneAcross` are coordinates on the perpendicular (cross) axis.
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.8 });
  const armMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.7 });
  const poleGeo = new THREE.CylinderGeometry(0.08, 0.08, 5, 6);
  const headGeo = new THREE.BoxGeometry(0.36, 1.05, 0.3);
  const bulbGeo = new THREE.SphereGeometry(0.11, 8, 8);
  const walkHousingGeo = new THREE.BoxGeometry(0.34, 0.46, 0.09);
  const walkLensGeo = new THREE.PlaneGeometry(0.24, 0.34);
  const axisPoint = (axis: "x" | "z", along: number, across: number): [number, number] =>
    axis === "z" ? [across, along] : [along, across];
  const makeMastSignal = (axis: "x" | "z", fixedPos: number, curbAcross: number, laneAcross: number, faceDir: 1 | -1, walkAlong: number) => {
    const [px, pz] = axisPoint(axis, fixedPos, curbAcross);
    city.add(mesh(poleGeo, poleMat, [px, 2.5, pz]));

    // Mast arm — a box stretched (not a fixed length) so it always meets the pole and the head.
    const armLen = Math.abs(laneAcross - curbAcross);
    const [amx, amz] = axisPoint(axis, fixedPos, (curbAcross + laneAcross) / 2);
    const arm = mesh(new THREE.BoxGeometry(armLen, 0.12, 0.12), armMat, [amx, 4.9, amz]);
    if (axis === "x") arm.rotation.y = Math.PI / 2; // stretch along z instead of the default x
    city.add(arm);

    const [hx, hz] = axisPoint(axis, fixedPos, laneAcross);
    const head = mesh(headGeo, armMat, [hx, 4.55, hz]);
    if (axis === "x") head.rotation.y = Math.PI / 2;
    city.add(head);

    const [bx, bz] = axisPoint(axis, fixedPos + faceDir * 0.17, laneAcross);
    const headLights = [
      mesh(bulbGeo, new THREE.MeshBasicMaterial({ color: 0x550000 }), [bx, 4.85, bz]),
      mesh(bulbGeo, new THREE.MeshBasicMaterial({ color: 0x554400 }), [bx, 4.55, bz]),
      mesh(bulbGeo, new THREE.MeshBasicMaterial({ color: 0x004400 }), [bx, 4.25, bz]),
    ];
    headLights.forEach(l => city.add(l));

    // Pedestrian signal — a dark housing bolted to the same pole (same position, so it's actually
    // attached, not floating), at eye height, its lens face nudged toward the crosswalk it reads for.
    const towardWalk = Math.sign(walkAlong - fixedPos) || 1;
    const [wx, wz] = axisPoint(axis, fixedPos, curbAcross);
    const housing = mesh(walkHousingGeo, new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6 }), [wx, 2.2, wz]);
    city.add(housing);
    const [lx, lz] = axisPoint(axis, fixedPos + towardWalk * 0.05, curbAcross);
    const lens = new THREE.Mesh(walkLensGeo, new THREE.MeshBasicMaterial({ color: 0x551a00 }));
    lens.position.set(lx, 2.2, lz);
    lens.rotation.y = (towardWalk > 0 ? 0 : Math.PI) + (axis === "x" ? Math.PI / 2 : 0);
    city.add(lens);

    return { headLights, walkLens: lens };
  };

  // Main road (NS) — each direction gets its own curbside signal at its stop line, facing back at
  // approaching traffic, plus a pedestrian signal for the crosswalk just past that stop line.
  const north = makeMastSignal("z", -STOP_OFFSET, 10, 3.5, 1, -INTERSECTION_HALF);
  const south = makeMastSignal("z", STOP_OFFSET, -10, -3.5, -1, INTERSECTION_HALF);
  // Cross street (EW) — same setup, rotated: a real second road with its own traffic and signal.
  const east = makeMastSignal("x", -EW_STOP_OFFSET, -INTERSECTION_HALF, -EW_LANE, 1, -EW_CROSSWALK_X);
  const west = makeMastSignal("x", EW_STOP_OFFSET, INTERSECTION_HALF, EW_LANE, -1, EW_CROSSWALK_X);

  const trafficLights: { lights: THREE.Mesh[]; axis: "x" | "z"; pos: number; dir: 1 | -1 }[] = [
    { lights: north.headLights, axis: "z", pos: -STOP_OFFSET, dir: 1 },   // northbound stops here
    { lights: south.headLights, axis: "z", pos: STOP_OFFSET, dir: -1 },   // southbound stops here
    { lights: east.headLights, axis: "x", pos: -EW_STOP_OFFSET, dir: 1 }, // eastbound stops here
    { lights: west.headLights, axis: "x", pos: EW_STOP_OFFSET, dir: -1 }, // westbound stops here
  ];
  const walkSigns = [north.walkLens, south.walkLens];
  const crossWalkSigns = [east.walkLens, west.walkLens];

  // Pedestrians — a low-poly figure. Geometry is shared across every instance (only materials
  // vary, picked from a small fixed palette) to keep the draw/memory cost of a whole crowd low.
  const skinTones = [0xd9b088, 0xc68a5e, 0x8d5a3c, 0xf0c8a0, 0x6b4530].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 }));
  const shirtColors = [0x304050, 0x8a3030, 0x2f6e4f, 0x6a4a90, 0xd0a030, 0xb0b8c0, 0xc05050].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }));
  const pantsColors = [0x202030, 0x3a3a3a, 0x1a2a3a, 0x4a3a2a].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 }));
  const legsGeo = new THREE.BoxGeometry(0.26, 0.4, 0.18);
  const torsoGeo = new THREE.BoxGeometry(0.32, 0.42, 0.2);
  const pedHeadGeo = new THREE.SphereGeometry(0.13, 7, 7);
  const packGeo = new THREE.BoxGeometry(0.2, 0.28, 0.12);
  const packMat = new THREE.MeshStandardMaterial({ color: 0x2a3a2a, roughness: 0.9 });
  const makePedestrian = () => {
    const grp = new THREE.Group();
    const legs = new THREE.Mesh(legsGeo, pantsColors[Math.floor(Math.random() * pantsColors.length)]);
    legs.position.y = 0.2; grp.add(legs);
    const torso = new THREE.Mesh(torsoGeo, shirtColors[Math.floor(Math.random() * shirtColors.length)]);
    torso.position.y = 0.61; grp.add(torso);
    const head = new THREE.Mesh(pedHeadGeo, skinTones[Math.floor(Math.random() * skinTones.length)]);
    head.position.y = 0.97; grp.add(head);
    if (Math.random() < 0.3) { // occasional backpack
      const pack = new THREE.Mesh(packGeo, packMat);
      pack.position.set(0, 0.62, -0.16); grp.add(pack);
    }
    grp.scale.setScalar(0.85 + Math.random() * 0.3); // height/build variety
    city.add(grp);
    return grp;
  };

  // A few dedicated crossers use the crosswalks (NS ones wait for the NS walk signal, EW ones for
  // the EW walk signal). Once one finishes a crossing it "graduates" — walks away down the far
  // sidewalk and disappears like a stroller, instead of immediately turning around to cross back.
  const crossers: { grp: THREE.Group; fixed: number; axis: "x" | "z"; gated: boolean; t: number; dir: 1 | -1; moving: boolean; graduated: boolean; strollDir: 1 | -1; strollSpeed: number }[] = [
    { grp: makePedestrian(), fixed: -INTERSECTION_HALF, axis: "x", gated: true, t: 0, dir: 1, moving: false, graduated: false, strollDir: 1, strollSpeed: 1 },
    { grp: makePedestrian(), fixed: INTERSECTION_HALF, axis: "x", gated: true, t: 1, dir: -1, moving: false, graduated: false, strollDir: -1, strollSpeed: 1 },
    { grp: makePedestrian(), fixed: -EW_CROSSWALK_X, axis: "z", gated: true, t: 0, dir: 1, moving: false, graduated: false, strollDir: 1, strollSpeed: 1 },
    { grp: makePedestrian(), fixed: EW_CROSSWALK_X, axis: "z", gated: true, t: 1, dir: -1, moving: false, graduated: false, strollDir: -1, strollSpeed: 1 },
  ];

  // Strollers walk the full length of whichever sidewalk they're on and wrap at WRAP_AT, exactly
  // like cars do on their road — both roads get their own population (8 on the longer main-road
  // sidewalks, 4 on the shorter cross-street ones, matching the 8-NS/4-EW car split above), and
  // both speed AND initial spacing are independently randomized per pedestrian so they don't read
  // as a mechanically evenly-spaced line.
  const strollers: { grp: THREE.Group; axis: "x" | "z"; dir: 1 | -1; speed: number }[] = [];
  const STROLLER_MARGIN = 5; // keep initial spawns a bit inside the wrap boundary, not exactly on it
  // How far a stroller's lateral position can jitter off its sidewalk's centerline — derived from
  // SIDEWALK_WIDTH itself (half of half the sidewalk), not an independent guess, so a pedestrian is
  // provably within the sidewalk's actual width (with room to spare) no matter how that width changes.
  const STROLLER_LANE_JITTER = SIDEWALK_WIDTH / 4;
  const addStroller = (axis: "x" | "z", along: number, across: number) => {
    const dir = (Math.random() < 0.5 ? 1 : -1) as 1 | -1;
    const grp = makePedestrian();
    if (axis === "z") grp.position.set(across, 0, along);
    else grp.position.set(along, 0, across);
    grp.rotation.y = axis === "z" ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    strollers.push({ grp, axis, dir, speed: 0.9 + Math.random() * 0.7 });
  };
  for (let i = 0; i < 8; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    // Avoid spawning inside the intersection's curb-cut gap (|z| < INTERSECTION_HALF) — a stroller
    // is protected there once actually simulating (see strollerStopAhead), but materializing already
    // inside it on load reads as popping into traffic rather than walking there.
    const segSign = Math.random() < 0.5 ? 1 : -1;
    const along = segSign * lerp(INTERSECTION_HALF, WRAP_AT.z - STROLLER_MARGIN, Math.random());
    addStroller("z", along, side * MAIN_SIDEWALK_X + (Math.random() - 0.5) * STROLLER_LANE_JITTER);
  }
  for (let i = 0; i < 4; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    // Unlike the main-road sidewalks, the cross-street ones are two disconnected segments (see
    // updateStrollers) — spawn within ONE segment, not across the whole wrap range, or half these
    // spawns would land in the road/empty gap between the segments instead of on a sidewalk.
    const segSign = Math.random() < 0.5 ? 1 : -1;
    const along = segSign * lerp(MAIN_SIDEWALK_OUTER, CROSS_SIDEWALK_FAR - STROLLER_MARGIN, Math.random());
    addStroller("x", along, side * CROSS_SIDEWALK_Z + (Math.random() - 0.5) * STROLLER_LANE_JITTER);
  }

  // Neon signs
  const signs: { mesh: THREE.Mesh; light: THREE.PointLight | null; color: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const x = (Math.random() > 0.5 ? 1 : -1) * (18 + Math.random() * 8), z = -80 + i * 14 + Math.random() * 6;
    if (Math.abs(z) < BUILDING_GAP) continue; // no building there to mount it on — skip, don't float it
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
    trafficLights, walkSigns, crossWalkSigns, crossers, strollers,
    buildingMats, sun, ambient, roadMat,
  };
}

// ── Signal timing ───────────────────────────────
// Real values, not "equal thirds": NS red must comfortably outlast a full NS pedestrian crossing
// (else pedestrians end up mid-crosswalk after the light's already gone back to green for cars),
// and EW mirrors NS exactly — EW is green+yellow for exactly the SIGNAL_RED_S window NS is red,
// and vice versa, so the two roads are always in complementary phase with no shared green.
const SIGNAL_GREEN_S = 5;
const SIGNAL_YELLOW_S = 1.5;
const SIGNAL_RED_S = 9;
const SIGNAL_CYCLE_S = SIGNAL_GREEN_S + SIGNAL_YELLOW_S + SIGNAL_RED_S;
const NS_RED_START_S = SIGNAL_GREEN_S + SIGNAL_YELLOW_S; // NS red (== EW green start) begins here
const EW_GREEN_S = SIGNAL_RED_S - SIGNAL_YELLOW_S; // fills NS's red window, minus EW's own yellow
const PED_CROSS_SPEED_NS = 1 / 7; // fraction/s for the ~22-unit NS crossing — 7s, comfortably under SIGNAL_RED_S
const PED_CROSS_SPEED_EW = 1 / 3; // fraction/s for the shorter ~9-unit EW crossing — 3s, comfortably under NS_RED_START_S
type SignalState = "red" | "yellow" | "green";

function computeSignalState(trafficPhase: number): SignalState {
  const s = trafficPhase % SIGNAL_CYCLE_S;
  if (s < SIGNAL_GREEN_S) return "green";
  if (s < NS_RED_START_S) return "yellow";
  return "red";
}

function computeCrossSignalState(trafficPhase: number): SignalState {
  const s = trafficPhase % SIGNAL_CYCLE_S;
  if (s < NS_RED_START_S) return "red";
  if (s < NS_RED_START_S + EW_GREEN_S) return "green";
  return "yellow";
}

function updateEnvironment(handles: CityHandles, time: number): number {
  const { sun, ambient, scene, renderer, roadMat } = handles;
  sun.color.copy(paletteAt(time, "sunCol"));
  sun.intensity = lerp(palettes.sunInt[0], palettes.sunInt[4], time);
  sun.position.set(Math.cos(Math.PI * (0.1 + time * 0.9)) * 30, Math.sin(Math.PI * (0.1 + time * 0.9)) * 30, 10);
  ambient.color.copy(paletteAt(time, "ambCol"));
  ambient.intensity = lerp(palettes.ambInt[0], palettes.ambInt[4], time);

  const skyC = paletteAt(time, "sky"), fogC = paletteAt(time, "fog");
  scene.background = skyC; scene.fog!.color.copy(fogC); renderer.setClearColor(skyC);
  roadMat.color.copy(paletteAt(time, "ground"));

  return 1 - Math.min(1, Math.max(0, (time - 0.5) * 1.5)); // dark: 1 at night, 0 at midday
}

function updateLampsAndSigns(handles: CityHandles, t: number, dark: number): void {
  handles.lamps.forEach(l => { l.light.intensity = 0.4 * dark; });
  handles.signs.forEach(s => {
    const flick = Math.sin(t * 8 + s.mesh.userData.phase) * 0.1 + s.mesh.userData.flicker;
    if (s.light) s.light.intensity = 0.6 * dark * (0.8 + flick * 0.2);
    const m = s.mesh.material as THREE.MeshBasicMaterial;
    const baseR = ((s.color >> 16) & 0xff) / 255;
    const baseG = ((s.color >> 8) & 0xff) / 255;
    const baseB = (s.color & 0xff) / 255;
    const k = dark * (0.7 + flick * 0.3);
    m.color.setRGB(baseR * k, baseG * k, baseB * k);
  });
}

function updateSignalHeads(trafficLights: CityHandles["trafficLights"], state: SignalState): void {
  for (const tl of trafficLights) {
    (tl.lights[0].material as THREE.MeshBasicMaterial).color.setHex(state === "red" ? 0xff2020 : 0x330000);
    (tl.lights[1].material as THREE.MeshBasicMaterial).color.setHex(state === "yellow" ? 0xffcc00 : 0x332200);
    (tl.lights[2].material as THREE.MeshBasicMaterial).color.setHex(state === "green" ? 0x00ff44 : 0x003300);
  }
}

function updateWalkSigns(walkSigns: THREE.Mesh[], nsWalkable: boolean): void {
  walkSigns.forEach(panel => {
    (panel.material as THREE.MeshBasicMaterial).color.setHex(nsWalkable ? 0xffa030 : 0x551a00);
  });
}

// A crosser starts parked at a curb (t === 0 or 1, moving === false). Gated crossers can only
// LEAVE the curb while their road's signal is walkable (NS crossers use nsWalkable, EW crossers
// use ewWalkable); once moving they always finish the crossing, so a light change mid-walk doesn't
// strand them. On arrival they "graduate": instead of turning around to cross back (which would
// have them bouncing on the road for the whole multi-cycle-long walk window, permanently blocking
// the pedestrian-safety check in tickCity that treats "someone's on the road" as an absolute stop),
// they walk away down the sidewalk they landed on and disappear the same way strollers do.
// Car safety around them isn't this function's job — see carTargetSpeedForPedestrian /
// clampAtPedestrian, which make any actively-crossing pedestrian a real obstacle to car physics
// regardless of what the traffic light says, the same way another car already is.
function updateCrossers(crossers: CityHandles["crossers"], nsWalkable: boolean, ewWalkable: boolean, dt: number): void {
  // THREE.Clock.getDelta() returns exactly 0 on its very first call (it just starts the clock) —
  // so the animation's first tick ever runs with dt === 0. That's normally harmless (zero elapsed
  // time, zero movement), but a fresh crosser's `t` starts pinned exactly at one arrival boundary
  // (0 or 1 — see createCity), and if they're eligible to leave the curb on that very first frame
  // (true for the EW crossers, since ewWalkable is already true at trafficPhase 0), a zero-progress
  // step still trivially satisfies "t >= 1 || t <= 0" — the check can't tell "just started" from
  // "just arrived" when they're the same value. That "graduates" them before they've taken a single
  // step of the actual crossing walk, and since the normal per-frame position-setting code (which
  // sets their crossing-axis coordinate from `t`) never got to run for them even once, they graduate
  // from wherever their THREE.Group defaulted to (0, 0, 0) — the middle of the intersection — instead
  // of from the crosswalk. A zero-duration frame can't move anyone into a new state; skip it outright.
  if (dt <= 0) return;
  crossers.forEach(p => {
    if (p.graduated) {
      // strollAxis is the OTHER axis from the one they crossed on: an "x"-crossing (main-road)
      // pedestrian now strolls along "z" (the length of the main-road sidewalk), and vice versa.
      // Each must wrap at WRAP_AT for ITS OWN axis, not the other road's — the cross street is much
      // shorter than the main road, so a stroller using the main road's wrap distance here would
      // walk straight off the end of the cross street into empty space before finally turning back.
      const strollAxis = p.axis === "x" ? "z" : "x";
      p.grp.position[strollAxis] += p.strollDir * p.strollSpeed * dt;
      const wrapAt = WRAP_AT[strollAxis];
      if (Math.abs(p.grp.position[strollAxis]) > wrapAt) p.grp.position[strollAxis] = -p.grp.position[strollAxis];
      return;
    }

    const walkable = p.axis === "x" ? nsWalkable : ewWalkable;
    if (!p.moving) {
      const canLeaveCurb = !p.gated || walkable;
      if (canLeaveCurb) p.moving = true;
    }
    if (p.moving) {
      const speed = p.axis === "x" ? PED_CROSS_SPEED_NS : PED_CROSS_SPEED_EW;
      p.t += p.dir * dt * speed;
      if (p.t >= 1 || p.t <= 0) {
        p.t = Math.max(0, Math.min(1, p.t));
        p.moving = false;
        p.graduated = true;
        // p.t is now exactly 0 or 1, so the crossing-axis coordinate they were lerping
        // (NS_CROSSWALK_SPAN / EW_CROSSWALK_SPAN) tells us which side of the road they landed on.
        // That's the crosswalk's own edge, not the sidewalk itself — snap onto the actual sidewalk
        // centerline for that side, or the graduated stroll below walks them down the curb/road
        // edge instead of the sidewalk.
        const arrivedSide = p.t >= 1 ? 1 : -1;
        if (p.axis === "x") p.grp.position.x = arrivedSide * MAIN_SIDEWALK_X;
        else p.grp.position.z = arrivedSide * CROSS_SIDEWALK_Z;
        // p.fixed is the coordinate they were pinned to while crossing (never 0 — it's always
        // ±INTERSECTION_HALF or ±EW_CROSSWALK_X) — its sign points away from the road centerline.
        // Stroll that way, onto the sidewalk; the other way walks straight into traffic.
        p.strollDir = Math.sign(p.fixed) as 1 | -1;
        p.strollSpeed = 0.9 + Math.random() * 0.7;
        p.grp.rotation.y = p.axis === "x"
          ? (p.strollDir > 0 ? 0 : Math.PI)
          : (p.strollDir > 0 ? Math.PI / 2 : -Math.PI / 2);
        return;
      }
    }
    if (p.axis === "x") {
      p.grp.position.set(lerp(-NS_CROSSWALK_SPAN, NS_CROSSWALK_SPAN, p.t), 0, p.fixed);
      p.grp.rotation.y = p.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      p.grp.position.set(p.fixed, 0, lerp(-EW_CROSSWALK_SPAN, EW_CROSSWALK_SPAN, p.t));
      p.grp.rotation.y = p.dir > 0 ? 0 : Math.PI;
    }
  });
}

function updateStrollers(strollers: CityHandles["strollers"], dt: number): void {
  strollers.forEach(p => {
    p.grp.position[p.axis] += p.dir * p.speed * dt;
    if (p.axis === "z") {
      // The main-road sidewalks really are one continuous run along z (the curb-cut gap at the
      // intersection is right beside them, not a break IN them, since they sit out at
      // MAIN_SIDEWALK_X the whole time) — wrapping by flipping the sign is correct here.
      const wrapAt = WRAP_AT.z;
      if (Math.abs(p.grp.position.z) > wrapAt) p.grp.position.z = -p.grp.position.z;
    } else {
      // The cross-street sidewalks are two DISCONNECTED segments — [MAIN_SIDEWALK_OUTER,
      // CROSS_SIDEWALK_FAR] and its mirror — with the road itself in the gap between them. Flipping
      // the sign on wrap (like the z case) would teleport a stroller across that gap into the
      // opposite segment, through where the road is. Confine each stroller to the segment it's
      // already on: wrap within it, never across the gap.
      const side = Math.sign(p.grp.position.x) || 1;
      if (Math.abs(p.grp.position.x) > CROSS_SIDEWALK_FAR) p.grp.position.x = side * MAIN_SIDEWALK_OUTER;
      else if (Math.abs(p.grp.position.x) < MAIN_SIDEWALK_OUTER) p.grp.position.x = side * CROSS_SIDEWALK_FAR;
    }
  });
}

const CAR_STOP_DIST = 4; // units before the stop line where cars start braking
const CAR_FOLLOW_DIST = 3.5; // units behind the car ahead where we start braking
const STROLLER_HAZARD_HALF_WIDTH = 0.5; // rough pedestrian body clearance, when a stroller is a car hazard outside any marked crosswalk (see strollerStopAhead) — not CROSSWALK_HALF_LEN, since that's specifically about painted crosswalk width, which doesn't apply here
// How far along each axis a car OR pedestrian travels before wrapping to the other end — matches
// each road's paved/sidewalk extent. Shared by cars (updateCars), strollers (updateStrollers), and
// graduated crossers (updateCrossers) — a pedestrian strolling the "x" axis (the cross street) must
// wrap at the same distance an "x"-axis car does, not at the much longer main-road distance, or
// they walk straight off the end of the cross street into empty space before finally wrapping.
const WRAP_AT: Record<"x" | "z", number> = { z: 100, x: 38 };

// Looks up the SignalState governing a given road axis (NS uses nsState, EW uses ewState).
type AxisState = Record<"x" | "z", SignalState>;

const CAR_STOP_DEADZONE = CAR_HALF_LENGTH + 0.3; // within this distance of the line on red, target speed is exactly 0, not just asymptotically close — measured to the bumper, not the car's center

function carTargetSpeedForSignal(c: THREE.Group, dir: 1 | -1, axis: "x" | "z", pos: number, maxSpeed: number, trafficLights: CityHandles["trafficLights"], states: AxisState): number {
  let targetSpeed = maxSpeed;
  const state = states[axis];
  for (const tl of trafficLights) {
    if (tl.axis !== axis || tl.dir !== dir) continue;
    const d = (tl.pos - pos) * dir; // positive if the stop line is still ahead
    if (d > 0 && d < CAR_STOP_DIST + 2) {
      if (state === "red") {
        // A pure 1 - d/window ramp only approaches 0 asymptotically, never quite reaching it —
        // a stopped car's target speed would sit at some tiny-but-nonzero value forever, creeping
        // forward every frame and getting yanked back by clampAtStopLine's hard clamp: visible
        // jitter. Snapping to a real, exact 0 once inside the deadzone removes the creep entirely.
        const brake = d < CAR_STOP_DEADZONE ? 1 : Math.max(0, 1 - d / (CAR_STOP_DIST + 2));
        targetSpeed = Math.min(targetSpeed, maxSpeed * (1 - brake));
      } else if (state === "yellow") {
        targetSpeed = Math.min(targetSpeed, maxSpeed * 0.3);
      }
      // green — go at full speed
    }
  }
  return targetSpeed;
}

const CAR_MIN_GAP = CAR_LENGTH + 0.6; // bumper-to-bumper (one car length) plus a visible buffer, measured center-to-center — the baseline every car's own followGap (see makeCar) jitters around

function carTargetSpeedForTraffic(c: THREE.Group, dir: 1 | -1, axis: "x" | "z", pos: number, maxSpeed: number, cars: THREE.Group[]): number {
  let gapAhead = Infinity;
  for (const other of cars) {
    if (other === c || other.userData.dir !== dir || other.userData.axis !== axis) continue;
    const d = (other.position[axis] - pos) * dir; // positive if other is ahead
    if (d > 0 && d < gapAhead) gapAhead = d;
  }
  if (gapAhead >= CAR_FOLLOW_DIST) return maxSpeed;
  const minGap = c.userData.followGap as number;
  // Clamped to [0, 1]: without the clamp, a gap tighter than minGap (e.g. from one frame of lag
  // before clampBehindLeader below catches it) drives brake past 1, which flips target speed
  // negative — the car visibly reverses into the one behind it, "bouncing" the queue apart.
  const brake = Math.min(1, Math.max(0, 1 - (gapAhead - minGap) / (CAR_FOLLOW_DIST - minGap)));
  return maxSpeed * (1 - brake);
}

// A pedestrian's danger zone is a BAND (their body/crosswalk width), not a single point a car either
// hasn't reached or has cleanly passed — and a car's own position at the instant a pedestrian
// becomes a hazard (a crosser starting to cross, or a stroller walking into an unprotected road
// gap) can already be anywhere inside that band, not just short of its near edge. Treating
// "gap > 0" (not yet at the near edge) as the only dangerous case — as an earlier version did —
// silently ignores a car already inside the band, which then drives straight through/past the
// pedestrian with zero braking. So a car is a hazard candidate as long as it hasn't cleared the FAR
// edge yet, and its stop target is the near edge — unless it's already past that too, in which case
// it must hold at its current position (a car can't retreat back out of a band it's already entered).
function hazardStopPoint(dir: 1 | -1, pos: number, hazardPos: number, halfWidth: number): number | null {
  const nearEdge = hazardPos - dir * halfWidth;
  const farEdge = hazardPos + dir * halfWidth;
  const clearedBand = (farEdge - pos) * dir <= 0;
  if (clearedBand) return null;
  const pastNearEdge = (nearEdge - pos) * dir <= 0;
  return pastNearEdge ? pos : nearEdge;
}

function nearestStop(dir: 1 | -1, a: number | null, b: number | null): number | null {
  if (a === null) return b;
  if (b === null) return a;
  return (a - b) * dir < 0 ? a : b; // whichever requires stopping sooner
}

// A pedestrian actively crossing the PERPENDICULAR crosswalk is a real obstacle to a car, exactly
// like the car ahead of it — and unlike the traffic-light checks below, this applies regardless of
// signal state. That matters because a car that already passed its own stop line before the light
// turned red is otherwise ungoverned by anything (clampAtStopLine only clamps cars still behind the
// line): without this, that car sails straight through a crosswalk someone's actually standing on.
// `p.fixed` is the crosswalk's coordinate on the car's travel axis; braking targets the near edge
// of the zebra-stripe band, not the crosswalk's centerline, so the car stops clear of it entirely.
function pedestrianStopAhead(dir: 1 | -1, axis: "x" | "z", pos: number, crossers: CityHandles["crossers"]): number | null {
  let stopAt: number | null = null;
  for (const p of crossers) {
    if (p.axis === axis || !p.moving) continue; // p.axis is the pedestrian's OWN walking axis — a crosser walking axis "x" crosses (is an obstacle to) axis "z" cars, and vice versa
    stopAt = nearestStop(dir, stopAt, hazardStopPoint(dir, pos, p.fixed, CROSSWALK_HALF_LEN));
  }
  return stopAt;
}

// Main-road (NS) strollers walk straight through the intersection's curb-cut gap (there's no
// sidewalk mesh there — see createCity's "split fore/aft of the intersection" sidewalks) at their
// fixed x = ±MAIN_SIDEWALK_X, for the stretch where |z| < INTERSECTION_HALF: that's literally the
// cross street's own paved surface. Unlike crossers, strollers aren't gated by any walk signal at
// all, so without this an EW car has zero reason to ever brake for one — it drives straight through.
// EW strollers never need the equivalent check: they're confined to their own sidewalk segments
// (see updateStrollers) and never enter the main road's band.
function strollerStopAhead(dir: 1 | -1, axis: "x" | "z", pos: number, strollers: CityHandles["strollers"]): number | null {
  if (axis !== "x") return null;
  let stopAt: number | null = null;
  for (const p of strollers) {
    if (p.axis !== "z" || Math.abs(p.grp.position.z) >= INTERSECTION_HALF) continue; // only a hazard while actually inside the cross street's paved band
    stopAt = nearestStop(dir, stopAt, hazardStopPoint(dir, pos, p.grp.position.x, STROLLER_HAZARD_HALF_WIDTH));
  }
  return stopAt;
}

function pedestrianHazardStop(dir: 1 | -1, axis: "x" | "z", pos: number, crossers: CityHandles["crossers"], strollers: CityHandles["strollers"]): number | null {
  return nearestStop(dir, pedestrianStopAhead(dir, axis, pos, crossers), strollerStopAhead(dir, axis, pos, strollers));
}

function carTargetSpeedForPedestrian(dir: 1 | -1, axis: "x" | "z", pos: number, maxSpeed: number, crossers: CityHandles["crossers"], strollers: CityHandles["strollers"]): number {
  const stopAt = pedestrianHazardStop(dir, axis, pos, crossers, strollers);
  if (stopAt === null) return maxSpeed;
  const d = Math.max(0, (stopAt - pos) * dir); // 0 when already at/past the stop point (inside the band) — brake fully, not just "close"
  if (d >= CAR_STOP_DIST + 2) return maxSpeed;
  const brake = d < CAR_STOP_DEADZONE ? 1 : Math.max(0, 1 - d / (CAR_STOP_DIST + 2));
  return maxSpeed * (1 - brake);
}

// Both clamps below share one shape: given a hard stop position `stopAt`, never let `nextPos`
// advance past it — UNLESS `pos` (last frame's actual position) is already past it, in which case
// this car is already committed/in transit and out of this clamp's jurisdiction (some other check —
// clampBehindLeader, or simply nothing, if it legitimately cleared the obstacle — governs it now).
// Critically, "past it" and "the clamp target" must be the SAME threshold. An earlier version
// gated on the painted stop-line position but snapped back to a point behind it (to account for the
// car's own length); that gap let a car already snapped to the queue position creep forward one
// tiny step at a time — each step alone too small to trigger "wouldCross the painted line" — before
// finally reaching the line and snapping back, over and over, instead of just staying put.
function clampAtStop(dir: 1 | -1, pos: number, nextPos: number, stopAt: number): number {
  // Strict "<": a car sitting exactly AT stopAt (the normal steady state once queued) must stay
  // clamped every frame, not be waved through as "already past" the instant it reaches the point.
  const alreadyPast = (stopAt - pos) * dir < 0;
  if (alreadyPast) return nextPos;
  const wouldPass = (stopAt - nextPos) * dir < 0;
  return wouldPass ? stopAt : nextPos;
}

function clampAtPedestrian(dir: 1 | -1, axis: "x" | "z", pos: number, nextPos: number, crossers: CityHandles["crossers"], strollers: CityHandles["strollers"]): number {
  const stopAt = pedestrianHazardStop(dir, axis, pos, crossers, strollers);
  return stopAt === null ? nextPos : clampAtStop(dir, pos, nextPos, stopAt);
}

// On red, clamp a car's position so it can never be nudged across its stop line by the speed
// easing above — this is what actually keeps cars off the crosswalk while pedestrians use it.
function clampAtStopLine(dir: 1 | -1, axis: "x" | "z", pos: number, nextPos: number, trafficLights: CityHandles["trafficLights"], states: AxisState): number {
  if (states[axis] !== "red") return nextPos;
  for (const tl of trafficLights) {
    if (tl.axis !== axis || tl.dir !== dir) continue;
    return clampAtStop(dir, pos, nextPos, tl.pos - dir * (CAR_HALF_LENGTH + 0.15));
  }
  return nextPos;
}

// The speed easing in carTargetSpeedForTraffic slows a follower down, but easing alone can still
// let it drift closer than CAR_MIN_GAP for a frame or two (the same lag clampAtStopLine exists to
// cover). This is the hard floor under that: a follower's position can never pass "leader minus
// CAR_MIN_GAP", full stop — the actual fix for cars bouncing into the one ahead of them.
function clampBehindLeader(c: THREE.Group, dir: 1 | -1, axis: "x" | "z", pos: number, nextPos: number, cars: THREE.Group[]): number {
  let leaderPos: number | null = null;
  let bestGap = Infinity;
  for (const other of cars) {
    if (other === c || other.userData.dir !== dir || other.userData.axis !== axis) continue;
    const gap = (other.position[axis] - pos) * dir;
    if (gap > 0 && gap < bestGap) { bestGap = gap; leaderPos = other.position[axis]; }
  }
  if (leaderPos === null) return nextPos;
  const maxPos = leaderPos - dir * (c.userData.followGap as number);
  const wouldPassLeader = (maxPos - nextPos) * dir < 0;
  return wouldPassLeader ? maxPos : nextPos;
}

function updateCars(cars: THREE.Group[], trafficLights: CityHandles["trafficLights"], crossers: CityHandles["crossers"], strollers: CityHandles["strollers"], states: AxisState, dt: number): void {
  cars.forEach(c => {
    const dir = c.userData.dir as 1 | -1;
    const axis = c.userData.axis as "x" | "z";
    const maxSpeed = c.userData.speed;
    const pos = c.position[axis];
    const targetSpeed = Math.max(0, Math.min(
      carTargetSpeedForSignal(c, dir, axis, pos, maxSpeed, trafficLights, states),
      carTargetSpeedForTraffic(c, dir, axis, pos, maxSpeed, cars),
      carTargetSpeedForPedestrian(dir, axis, pos, maxSpeed, crossers, strollers),
    ));
    c.userData.currentSpeed = lerp(c.userData.currentSpeed ?? maxSpeed, targetSpeed, dt * 2.2); // gentler than dt*4 — noticeably abrupt braking read as cars "slamming" to a stop
    let nextPos = pos + dir * c.userData.currentSpeed * dt;
    nextPos = clampAtStopLine(dir, axis, pos, nextPos, trafficLights, states);
    nextPos = clampAtPedestrian(dir, axis, pos, nextPos, crossers, strollers);
    nextPos = clampBehindLeader(c, dir, axis, pos, nextPos, cars);
    const wrapAt = WRAP_AT[axis];
    c.position[axis] = Math.abs(nextPos) > wrapAt ? -nextPos : nextPos;
  });
}

// ── Per-frame update ──────────────────────────
export function tickCity(handles: CityHandles, t: number, dt: number, trafficPhase: number, time: number): { dark: number } {
  const dark = updateEnvironment(handles, time);
  updateLampsAndSigns(handles, t, dark);

  const nsState = computeSignalState(trafficPhase);
  const ewState = computeCrossSignalState(trafficPhase);
  const nsWalkable = nsState === "red";
  const ewWalkable = ewState === "red";
  updateSignalHeads(handles.trafficLights.filter(tl => tl.axis === "z"), nsState);
  updateSignalHeads(handles.trafficLights.filter(tl => tl.axis === "x"), ewState);
  updateWalkSigns(handles.walkSigns, nsWalkable);
  updateWalkSigns(handles.crossWalkSigns, ewWalkable);
  updateCrossers(handles.crossers, nsWalkable, ewWalkable, dt);
  updateStrollers(handles.strollers, dt);

  const states: AxisState = { z: nsState, x: ewState };
  updateCars(handles.cars, handles.trafficLights, handles.crossers, handles.strollers, states, dt);

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
