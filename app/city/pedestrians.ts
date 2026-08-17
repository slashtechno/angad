import * as THREE from "three";
import { lerp } from "./utils";
import {
  INTERSECTION_HALF, EW_CROSSWALK_X, MAIN_SIDEWALK_X, CROSS_SIDEWALK_Z, CROSS_SIDEWALK_FAR,
  MAIN_SIDEWALK_OUTER, SIDEWALK_WIDTH, NS_CROSSWALK_SPAN, EW_CROSSWALK_SPAN, WRAP_AT,
  PED_CROSS_SPEED_NS, PED_CROSS_SPEED_EW, PED_DEPARTURE_MARGIN_S,
} from "./constants";
import type { SignalPhase } from "./signals";
import type { CityHandles } from "./scene-types";

type Axis = "x" | "z";
const otherAxis = (a: Axis): Axis => (a === "x" ? "z" : "x");

// ── Visual construction ────────────────────────
// A low-poly pedestrian figure. Geometry is shared across every instance (only materials vary).
const skinTones = [0xd9b088, 0xc68a5e, 0x8d5a3c, 0xf0c8a0, 0x6b4530].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 }));
const shirtColors = [0x304050, 0x8a3030, 0x2f6e4f, 0x6a4a90, 0xd0a030, 0xb0b8c0, 0xc05050].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }));
const pantsColors = [0x202030, 0x3a3a3a, 0x1a2a3a, 0x4a3a2a].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 }));
const legsGeo = new THREE.BoxGeometry(0.26, 0.4, 0.18);
const torsoGeo = new THREE.BoxGeometry(0.32, 0.42, 0.2);
const pedHeadGeo = new THREE.SphereGeometry(0.13, 7, 7);
const packGeo = new THREE.BoxGeometry(0.2, 0.28, 0.12);
const packMat = new THREE.MeshStandardMaterial({ color: 0x2a3a2a, roughness: 0.9 });

export function makePedestrian(city: THREE.Group): THREE.Group {
  const grp = new THREE.Group();
  const legs = new THREE.Mesh(legsGeo, pantsColors[Math.floor(Math.random() * pantsColors.length)]);
  legs.position.y = 0.2; grp.add(legs);
  const torso = new THREE.Mesh(torsoGeo, shirtColors[Math.floor(Math.random() * shirtColors.length)]);
  torso.position.y = 0.61; grp.add(torso);
  const head = new THREE.Mesh(pedHeadGeo, skinTones[Math.floor(Math.random() * skinTones.length)]);
  head.position.y = 0.97; grp.add(head);
  if (Math.random() < 0.3) {
    const pack = new THREE.Mesh(packGeo, packMat);
    pack.position.set(0, 0.62, -0.16); grp.add(pack);
  }
  grp.scale.setScalar(0.85 + Math.random() * 0.3);
  city.add(grp);
  return grp;
}

// ── Crossers (follow pedestrian signals) ────────
// A crosser walks along `axis` across the road that runs along `otherAxis(axis)`, pinned at `fixed`
// on the perpendicular axis (the crosswalk's location). `t` is normalized progress across the
// crosswalk (0 = one curb, 1 = the other), moving in direction `dir`.
//   - NS crossers (axis "x") cross the main road at z = ±INTERSECTION_HALF, gated by the NS walk signal.
//   - EW crossers (axis "z") cross the cross street at x = ±EW_CROSSWALK_X, gated by the EW walk signal.
// A crosser may only leave the curb while its walk signal is on AND enough of the walk window remains
// to finish (see PED_DEPARTURE_MARGIN_S); once moving it always finishes the crossing, then turns
// around and waits for the next walk window to cross back.
export function buildCrossers(city: THREE.Group): CityHandles["crossers"] {
  return [
    { grp: makePedestrian(city), axis: "x", fixed: -INTERSECTION_HALF, t: 0, dir: 1, moving: false },
    { grp: makePedestrian(city), axis: "x", fixed: INTERSECTION_HALF, t: 1, dir: -1, moving: false },
    { grp: makePedestrian(city), axis: "z", fixed: -EW_CROSSWALK_X, t: 0, dir: 1, moving: false },
    { grp: makePedestrian(city), axis: "z", fixed: EW_CROSSWALK_X, t: 1, dir: -1, moving: false },
  ];
}

export function updateCrossers(crossers: CityHandles["crossers"], phase: SignalPhase, dt: number): void {
  for (const p of crossers) {
    const walkable = p.axis === "x" ? phase.nsWalk : phase.ewWalk;
    const remaining = p.axis === "x" ? phase.nsWalkRemaining : phase.ewWalkRemaining;
    const span = p.axis === "x" ? NS_CROSSWALK_SPAN : EW_CROSSWALK_SPAN;
    const speedFrac = p.axis === "x" ? PED_CROSS_SPEED_NS : PED_CROSS_SPEED_EW;
    const crossingDuration = 1 / speedFrac;

    // Pinned to the crosswalk while at the curb or crossing.
    p.grp.position[otherAxis(p.axis)] = p.fixed;
    p.grp.rotation.y = p.axis === "z" ? (p.dir > 0 ? 0 : Math.PI) : (p.dir > 0 ? Math.PI / 2 : -Math.PI / 2);

    if (!p.moving && walkable && remaining >= crossingDuration + PED_DEPARTURE_MARGIN_S) {
      p.moving = true; // enough of the walk window is left — safe to step off the curb
    }
    if (p.moving) {
      p.t += p.dir * speedFrac * dt;
      if (p.dir > 0 ? p.t >= 1 : p.t <= 0) {
        p.t = p.dir > 0 ? 1 : 0;
        p.moving = false; // arrived — wait at the far curb for the next walk window
        p.dir = (p.dir * -1) as 1 | -1;
      }
    }
    p.grp.position[p.axis] = lerp(-span, span, p.t);
  }
}

// ── Strollers (sidewalk ambience, never enter the road) ──
// Strollers walk the full length of a sidewalk and wrap, exactly like cars do on their road. They
// are confined to the sidewalk (their `across` coordinate is fixed on the sidewalk centerline), so
// they never enter the road and can never collide with a car.
const STROLLER_MARGIN = 5;
const STROLLER_LANE_JITTER = SIDEWALK_WIDTH / 4;

export function buildStrollers(city: THREE.Group): CityHandles["strollers"] {
  const strollers: CityHandles["strollers"] = [];
  const addStroller = (axis: Axis, along: number, across: number) => {
    const dir = (Math.random() < 0.5 ? 1 : -1) as 1 | -1;
    const grp = makePedestrian(city);
    if (axis === "z") grp.position.set(across, 0, along);
    else grp.position.set(along, 0, across);
    grp.rotation.y = axis === "z" ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    strollers.push({ grp, axis, dir, speed: 0.9 + Math.random() * 0.7 });
  };
  // Main-road sidewalks (at x = ±MAIN_SIDEWALK_X), walking along z.
  for (let i = 0; i < 8; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const segSign = Math.random() < 0.5 ? 1 : -1;
    const along = segSign * lerp(INTERSECTION_HALF, WRAP_AT.z - STROLLER_MARGIN, Math.random());
    addStroller("z", along, side * MAIN_SIDEWALK_X + (Math.random() - 0.5) * STROLLER_LANE_JITTER);
  }
  // Cross-street sidewalks (at z = ±CROSS_SIDEWALK_Z), walking along x within one segment.
  for (let i = 0; i < 4; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const segSign = Math.random() < 0.5 ? 1 : -1;
    const along = segSign * lerp(MAIN_SIDEWALK_OUTER, CROSS_SIDEWALK_FAR - STROLLER_MARGIN, Math.random());
    addStroller("x", along, side * CROSS_SIDEWALK_Z + (Math.random() - 0.5) * STROLLER_LANE_JITTER);
  }
  return strollers;
}

export function updateStrollers(strollers: CityHandles["strollers"], dt: number): void {
  for (const p of strollers) {
    p.grp.position[p.axis] += p.dir * p.speed * dt;
    if (p.axis === "z") {
      if (Math.abs(p.grp.position.z) > WRAP_AT.z) p.grp.position.z -= Math.sign(p.grp.position.z) * 2 * WRAP_AT.z;
    } else {
      // Cross-street sidewalks are two disconnected segments with the road in the gap between them.
      // Confine each stroller to the segment it's already on: wrap within it, never across the gap.
      const side = Math.sign(p.grp.position.x) || 1;
      if (Math.abs(p.grp.position.x) > CROSS_SIDEWALK_FAR) p.grp.position.x = side * MAIN_SIDEWALK_OUTER;
      else if (Math.abs(p.grp.position.x) < MAIN_SIDEWALK_OUTER) p.grp.position.x = side * CROSS_SIDEWALK_FAR;
    }
  }
}
