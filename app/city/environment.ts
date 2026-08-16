import * as THREE from "three";
import { paletteAt, lerp } from "./utils";
import { palettes } from "./constants";
import type { CityHandles } from "./scene-types";

export function updateEnvironment(handles: CityHandles, time: number): number {
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

export function updateLampsAndSigns(handles: CityHandles, t: number, dark: number): void {
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
