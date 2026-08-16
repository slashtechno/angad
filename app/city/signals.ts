import * as THREE from "three";
import { mesh } from "./utils";
import {
  EW_LANE, EW_STOP_OFFSET, STOP_OFFSET, EW_CROSSWALK_X, INTERSECTION_HALF,
  SIGNAL_CYCLE_S, NS_GREEN_END_S, NS_YELLOW_END_S, EW_GREEN_START_S, EW_GREEN_END_S, EW_YELLOW_END_S,
} from "./constants";
import type { SignalState } from "./constants";
import type { CityHandles } from "./scene-types";

// ── Signal phase (single source of truth) ──────
// Everything — the lights, the cars, and the pedestrians — reads from this one function, so they
// can never drift out of sync. Given the current point in the signal cycle it returns:
//   - nsLight / ewLight : the traffic light state for each road
//   - nsWalk / ewWalk   : whether each road's pedestrians may cross
//   - nsWalkRemaining / ewWalkRemaining : seconds of walk window left (0 while not walkable)
//
// A road's pedestrians may cross exactly while its cars are stopped (its light is red) AND the
// all-red clearance gap has already elapsed — so a car that entered on green has had time to clear
// the crosswalk before a pedestrian is ever invited to step out.
export interface SignalPhase {
  nsLight: SignalState;
  ewLight: SignalState;
  nsWalk: boolean;
  ewWalk: boolean;
  nsWalkRemaining: number;
  ewWalkRemaining: number;
}

export function computeSignalPhase(trafficPhase: number): SignalPhase {
  const s = trafficPhase % SIGNAL_CYCLE_S;
  const nsLight: SignalState = s < NS_GREEN_END_S ? "green" : s < NS_YELLOW_END_S ? "yellow" : "red";
  const ewLight: SignalState = s < EW_GREEN_START_S ? "red" : s < EW_GREEN_END_S ? "green" : s < EW_YELLOW_END_S ? "yellow" : "red";
  const nsWalk = s >= EW_GREEN_START_S; // NS cars stopped + all-red passed
  const ewWalk = s < EW_GREEN_START_S; // EW cars stopped + all-red passed
  return {
    nsLight, ewLight, nsWalk, ewWalk,
    nsWalkRemaining: nsWalk ? SIGNAL_CYCLE_S - s : 0,
    ewWalkRemaining: ewWalk ? EW_GREEN_START_S - s : 0,
  };
}

// ── Visual updates ────────────────────────────
export function updateSignalHeads(trafficLights: CityHandles["trafficLights"], state: SignalState): void {
  for (const tl of trafficLights) {
    (tl.lights[0].material as THREE.MeshBasicMaterial).color.setHex(state === "red" ? 0xff2020 : 0x330000);
    (tl.lights[1].material as THREE.MeshBasicMaterial).color.setHex(state === "yellow" ? 0xffcc00 : 0x332200);
    (tl.lights[2].material as THREE.MeshBasicMaterial).color.setHex(state === "green" ? 0x00ff44 : 0x003300);
  }
}

export function updateWalkSigns(walkSigns: THREE.Mesh[], walkable: boolean): void {
  walkSigns.forEach(panel => {
    (panel.material as THREE.MeshBasicMaterial).color.setHex(walkable ? 0xffa030 : 0x551a00);
  });
}

// ── Visual construction ────────────────────────
// A curbside pole with a mast arm reaching over the lane it controls, single-faced, lens toward
// approaching traffic, plus a pedestrian signal box on the same pole near the crosswalk.
const poleMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.8 });
const armMat = new THREE.MeshStandardMaterial({ color: 0x3a3a3a, roughness: 0.7 });
const poleGeo = new THREE.CylinderGeometry(0.08, 0.08, 5, 6);
const headGeo = new THREE.BoxGeometry(0.36, 1.05, 0.3);
const bulbGeo = new THREE.SphereGeometry(0.11, 8, 8);
const walkHousingGeo = new THREE.BoxGeometry(0.34, 0.46, 0.09);
const walkLensGeo = new THREE.PlaneGeometry(0.24, 0.34);

const axisPoint = (axis: "x" | "z", along: number, across: number): [number, number] =>
  axis === "z" ? [across, along] : [along, across];

function makeMastSignal(city: THREE.Group, axis: "x" | "z", fixedPos: number, curbAcross: number, laneAcross: number, faceDir: 1 | -1, walkAlong: number) {
  const [px, pz] = axisPoint(axis, fixedPos, curbAcross);
  city.add(mesh(poleGeo, poleMat, [px, 2.5, pz]));

  const armLen = Math.abs(laneAcross - curbAcross);
  const [amx, amz] = axisPoint(axis, fixedPos, (curbAcross + laneAcross) / 2);
  const arm = mesh(new THREE.BoxGeometry(armLen, 0.12, 0.12), armMat, [amx, 4.9, amz]);
  if (axis === "x") arm.rotation.y = Math.PI / 2;
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
}

// Four signals — one per approach (north/south on the main road, east/west on the cross street),
// each with a traffic light head and a pedestrian walk sign for the crosswalk just past its stop line.
export function buildTrafficSignals(city: THREE.Group, mainSidewalkInner: number, mainLane: number) {
  const north = makeMastSignal(city, "z", -STOP_OFFSET, mainSidewalkInner, mainLane, 1, -INTERSECTION_HALF);
  const south = makeMastSignal(city, "z", STOP_OFFSET, -mainSidewalkInner, -mainLane, -1, INTERSECTION_HALF);
  const east = makeMastSignal(city, "x", -EW_STOP_OFFSET, -INTERSECTION_HALF, -EW_LANE, 1, -EW_CROSSWALK_X);
  const west = makeMastSignal(city, "x", EW_STOP_OFFSET, INTERSECTION_HALF, EW_LANE, -1, EW_CROSSWALK_X);

  const trafficLights: CityHandles["trafficLights"] = [
    { lights: north.headLights, axis: "z", pos: -STOP_OFFSET, dir: 1 },
    { lights: south.headLights, axis: "z", pos: STOP_OFFSET, dir: -1 },
    { lights: east.headLights, axis: "x", pos: -EW_STOP_OFFSET, dir: 1 },
    { lights: west.headLights, axis: "x", pos: EW_STOP_OFFSET, dir: -1 },
  ];
  const walkSigns = [north.walkLens, south.walkLens];
  const crossWalkSigns = [east.walkLens, west.walkLens];

  return { trafficLights, walkSigns, crossWalkSigns };
}
