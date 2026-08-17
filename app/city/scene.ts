import * as THREE from "three";
import { makeWindowTexture } from "./utils";
import { addBuilding } from "./buildings";
import { buildRoadway, BUILDING_GAP } from "./roadway";
import { makeCar, updateCars } from "./cars";
import { buildTrafficSignals, computeSignalPhase, updateSignalHeads, updateWalkSigns } from "./signals";
import { buildWalkers, updateWalkers } from "./pedestrians";
import { updateEnvironment, updateLampsAndSigns } from "./environment";
import { mulberry32 } from "./utils";
import { signColors, EW_LANE, MAIN_SIDEWALK_INNER } from "./constants";
import type { CityHandles, CityOptions } from "./scene-types";

export type { CityHandles, CityOptions } from "./scene-types";
export { makeCar } from "./cars";
export { mulberry32, lerp, ss, lerpColor, paletteAt, makeWindowTexture, mesh } from "./utils";
export { addBuilding, addRoofEquipment } from "./buildings";
export { carColors, signColors, CAR_LENGTH, CAR_HALF_LENGTH } from "./constants";

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

  const { roadMat } = buildRoadway(city);

  // Buildings — all rows leave a gap at the cross street opening
  const rng = mulberry32(42);
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

  // Cars — main road (NS) plus a smaller flow on the cross street (EW). Each car spawns on one
  // side of the intersection, facing toward it, far enough out that it never materializes inside the
  // intersection or on top of a stop line. Cars on a side are placed at evenly-spaced base positions
  // (with a little jitter) so two cars never spawn on top of each other.
  const cars: THREE.Group[] = [];
  for (let i = 0; i < 8; i++) {
    const side = i % 2 === 0 ? -1 : 1; // which side of the intersection it starts on
    const dir = (side === -1 ? 1 : -1) as 1 | -1; // face toward the intersection
    const idx = Math.floor(i / 2); // 0..3 per side
    const start = side * (10 + idx * 20 + Math.random() * 5);
    cars.push(makeCar(city, dir, dir * 3.5, start, "z"));
  }
  for (let i = 0; i < 4; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const dir = (side === -1 ? 1 : -1) as 1 | -1;
    const idx = Math.floor(i / 2); // 0..1 per side
    const start = side * (20 + idx * 15 + Math.random() * 3);
    cars.push(makeCar(city, dir, dir > 0 ? -EW_LANE : EW_LANE, start, "x"));
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

  // Traffic signals + pedestrian walk signs (main road + cross street)
  const { trafficLights, walkSigns, crossWalkSigns } = buildTrafficSignals(city, MAIN_SIDEWALK_INNER, 3.5);

  // Pedestrians — sidewalk walkers (spawn where cars do, cross/continue at the intersection).
  const walkers = buildWalkers(city);

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
    trafficLights, walkSigns, crossWalkSigns, walkers,
    buildingMats, sun, ambient, roadMat,
  };
}

// Traffic lights are grouped by axis once here (not re-filtered every tick — see tickCity below).
const trafficLightsByAxis = new WeakMap<CityHandles, { ns: CityHandles["trafficLights"]; ew: CityHandles["trafficLights"] }>();
function getTrafficLightsByAxis(handles: CityHandles) {
  let grouped = trafficLightsByAxis.get(handles);
  if (!grouped) {
    grouped = {
      ns: handles.trafficLights.filter(tl => tl.axis === "z"),
      ew: handles.trafficLights.filter(tl => tl.axis === "x"),
    };
    trafficLightsByAxis.set(handles, grouped);
  }
  return grouped;
}

// ── Per-frame update ──────────────────────────
export function tickCity(handles: CityHandles, t: number, dt: number, trafficPhase: number, time: number): { dark: number } {
  const dark = updateEnvironment(handles, time);
  updateLampsAndSigns(handles, t, dark);

  const phase = computeSignalPhase(trafficPhase);
  const { ns, ew } = getTrafficLightsByAxis(handles);
  updateSignalHeads(ns, phase.nsLight);
  updateSignalHeads(ew, phase.ewLight);
  updateWalkSigns(handles.walkSigns, phase.nsWalk);
  updateWalkSigns(handles.crossWalkSigns, phase.ewWalk);
  updateWalkers(handles.walkers, phase, dt);

  updateCars(handles.cars, handles.walkers, phase, dt);

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
