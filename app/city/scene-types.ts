import * as THREE from "three";

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
  crossers: { grp: THREE.Group; fixed: number; axis: "x" | "z"; t: number; dir: 1 | -1; moving: boolean }[];
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
