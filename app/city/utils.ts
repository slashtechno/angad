import * as THREE from "three";
import { palettes } from "./constants";

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

// ── Three.js helpers ────────────────────────────
export function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, pos: [number, number, number] = [0, 0, 0]) {
  const m = new THREE.Mesh(geo, mat); m.position.set(...pos); return m;
}
