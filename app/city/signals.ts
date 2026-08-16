import * as THREE from "three";
import { mesh } from "./utils";
import { EW_LANE, EW_STOP_OFFSET, STOP_OFFSET, EW_CROSSWALK_X, INTERSECTION_HALF, SIGNAL_GREEN_S, SIGNAL_YELLOW_S, SIGNAL_CYCLE_S, NS_RED_START_S, EW_GREEN_S } from "./constants";
import type { SignalState } from "./constants";
import type { CityHandles } from "./scene-types";

export function computeSignalState(trafficPhase: number): SignalState {
  const s = trafficPhase % SIGNAL_CYCLE_S;
  if (s < SIGNAL_GREEN_S) return "green";
  if (s < NS_RED_START_S) return "yellow";
  return "red";
}

export function computeCrossSignalState(trafficPhase: number): SignalState {
  const s = trafficPhase % SIGNAL_CYCLE_S;
  if (s < NS_RED_START_S) return "red";
  if (s < NS_RED_START_S + EW_GREEN_S) return "green";
  return "yellow";
}

export function updateSignalHeads(trafficLights: CityHandles["trafficLights"], state: SignalState): void {
  for (const tl of trafficLights) {
    (tl.lights[0].material as THREE.MeshBasicMaterial).color.setHex(state === "red" ? 0xff2020 : 0x330000);
    (tl.lights[1].material as THREE.MeshBasicMaterial).color.setHex(state === "yellow" ? 0xffcc00 : 0x332200);
    (tl.lights[2].material as THREE.MeshBasicMaterial).color.setHex(state === "green" ? 0x00ff44 : 0x003300);
  }
}

export function updateWalkSigns(walkSigns: THREE.Mesh[], nsWalkable: boolean): void {
  walkSigns.forEach(panel => {
    (panel.material as THREE.MeshBasicMaterial).color.setHex(nsWalkable ? 0xffa030 : 0x551a00);
  });
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

function makeMastSignal(city: THREE.Group, axis: "x" | "z", fixedPos: number, curbAcross: number, laneAcross: number, faceDir: 1 | -1, walkAlong: number) {
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
}

// Main road (NS) — each direction gets its own curbside signal at its stop line, facing back at
// approaching traffic, plus a pedestrian signal for the crosswalk just past that stop line.
// Cross street (EW) — same setup, rotated: a real second road with its own traffic and signal.
export function buildTrafficSignals(city: THREE.Group, mainSidewalkInner: number, mainLane: number) {
  const north = makeMastSignal(city, "z", -STOP_OFFSET, mainSidewalkInner, mainLane, 1, -INTERSECTION_HALF);
  const south = makeMastSignal(city, "z", STOP_OFFSET, -mainSidewalkInner, -mainLane, -1, INTERSECTION_HALF);
  const east = makeMastSignal(city, "x", -EW_STOP_OFFSET, -INTERSECTION_HALF, -EW_LANE, 1, -EW_CROSSWALK_X);
  const west = makeMastSignal(city, "x", EW_STOP_OFFSET, INTERSECTION_HALF, EW_LANE, -1, EW_CROSSWALK_X);

  const trafficLights: CityHandles["trafficLights"] = [
    { lights: north.headLights, axis: "z", pos: -STOP_OFFSET, dir: 1 },   // northbound stops here
    { lights: south.headLights, axis: "z", pos: STOP_OFFSET, dir: -1 },   // southbound stops here
    { lights: east.headLights, axis: "x", pos: -EW_STOP_OFFSET, dir: 1 }, // eastbound stops here
    { lights: west.headLights, axis: "x", pos: EW_STOP_OFFSET, dir: -1 }, // westbound stops here
  ];
  const walkSigns = [north.walkLens, south.walkLens];
  const crossWalkSigns = [east.walkLens, west.walkLens];

  return { trafficLights, walkSigns, crossWalkSigns };
}
