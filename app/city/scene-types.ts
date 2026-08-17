import * as THREE from "three";

// A single straight movement leg a pedestrian walks: either a sidewalk run (crosswalk:false) or
// a crosswalk crossing (crosswalk:true). `axis` is the direction of travel, `fixed` is the walker's
// coordinate on the OTHER axis, `start`/`target` are the along-axis endpoints, and `crosswalk`
// marks legs that cross a road (so cars must stop for them and they wait on a walk signal).
export interface WalkerLeg {
  axis: "x" | "z";
  fixed: number;
  start: number;
  target: number;
  crosswalk: boolean;
}

// A pedestrian that spawns out of view on a sidewalk (where cars do), walks to the intersection,
// and there either continues straight off-screen or turns into a crosswalk and exits off-screen.
// It walks `legs[leg]` next; `walking` is false while it waits at a curb for a walk signal.
export interface Walker {
  grp: THREE.Group;
  legs: WalkerLeg[];
  leg: number;
  sidewalkSpeed: number;
  crossSpeed: number;
  needsWalk: "ns" | "ew" | null;
  walking: boolean;
}

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
  walkers: Walker[];
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
