import * as THREE from "three";
import { lerp } from "./utils";
import {
  INTERSECTION_HALF, EW_CROSSWALK_X, CROSS_SIDEWALK_Z, CROSS_SIDEWALK_FAR, WRAP_AT, PED_DEPARTURE_MARGIN_S,
} from "./constants";
import type { SignalPhase } from "./signals";
import type { Walker, WalkerLeg } from "./scene-types";

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

// ── Walkers (spawn on sidewalks, cross or continue at the intersection) ────────
// Each walker spawns out of view on a sidewalk (where the cars spawn), walks toward the intersection,
// and there makes a one-time choice:
//   - STRAIGHT: keep walking in the same direction, across the intersection and off-screen.
//   - TURN:     turn onto the perpendicular sidewalk / crosswalk, then continue off-screen.
// A walker can come in on either road: a main-road (z-axis) walker on a main sidewalk, or a
// cross-street (x-axis) walker on a cross-street sidewalk — so pedestrians are visible moving both
// up/down the screen (main road) and left/right (cross street).
// Because a walker always exits off-screen and never reverses, no pedestrian shuttles back and forth
// on the same crosswalk (the old behaviour that looked like pacing). A walker only enters its
// crosswalk while the corresponding walk signal is on AND enough of the window remains to finish
// (see PED_DEPARTURE_MARGIN_S); once committed it always finishes, then continues to its exit.
const WALKER_Z_COUNT = 12; // main-road walkers (move along z)
const WALKER_X_COUNT = 12; // cross-street walkers (move along x)
const WALKER_TURN_CHANCE = 0.5;
const WALKER_SIDEWALK_SPEED = 1.3;
const WALKER_CROSS_SPEED = 2.6;
const WALKER_EXIT_MARGIN = 5; // walk this far beyond the sidewalk edge to be safely off-screen

// Which walk signal gates entering `leg`, or null if it's a plain sidewalk run.
function legNeedsWalk(leg: WalkerLeg): "ns" | "ew" | null {
  if (!leg.crosswalk) return null;
  return leg.axis === "x" ? "ns" : "ew"; // axis x crosses the main road (NS), axis z crosses the cross street (EW)
}

// Build the leg list for one walker and its starting (x, z) position.
// `axis` picks which road it approaches on: "z" = main road (main sidewalk), "x" = cross street
// (cross-street sidewalk). `sideZ` is which half of the main road it starts on (north/south),
// `sideX` which side of the cross street (east/west), `idx` staggers multiple walkers on the same
// sidewalk the way cars are staggered. A walker spawns out of view and walks toward the intersection.
function routeFor(axis: "z" | "x", sideZ: 1 | -1, sideX: 1 | -1, idx: number): { legs: WalkerLeg[]; startPos: [number, number] } {
  const turn = Math.random() < WALKER_TURN_CHANCE;

  if (axis === "z") {
    // ── Main-road walker: approaches along the main sidewalk (x = ±14), walking in z ──
    const startZ = sideZ * (10 + idx * 20 + Math.random() * 5);
    const fixedX = sideX * EW_CROSSWALK_X; // main sidewalk centerline == EW crosswalk centerline
    const legs: WalkerLeg[] = [
      // 1. Walk the main sidewalk down to the intersection curb.
      { axis: "z", fixed: fixedX, start: startZ, target: sideZ * INTERSECTION_HALF, crosswalk: false },
    ];
    if (turn) {
      // 2. Cross the cross street on the EW crosswalk, arriving at the far cross-street sidewalk.
      legs.push({ axis: "z", fixed: fixedX, start: sideZ * INTERSECTION_HALF, target: -sideZ * CROSS_SIDEWALK_Z, crosswalk: true });
      // 3. Walk that cross-street sidewalk outward to off-screen.
      legs.push({ axis: "x", fixed: -sideZ * CROSS_SIDEWALK_Z, start: fixedX, target: sideX * (CROSS_SIDEWALK_FAR + WALKER_EXIT_MARGIN), crosswalk: false });
    } else {
      // 2. Keep going straight on the same sidewalk, past the intersection, to off-screen.
      legs.push({ axis: "z", fixed: fixedX, start: sideZ * INTERSECTION_HALF, target: -sideZ * (WRAP_AT.z + WALKER_EXIT_MARGIN), crosswalk: false });
    }
    return { legs, startPos: [fixedX, startZ] };
  }

  // ── Cross-street walker: approaches along a cross-street sidewalk (z = ±8), walking in x ──
  const startX = sideX * (20 + idx * 15 + Math.random() * 3);
  const fixedZ = sideZ * CROSS_SIDEWALK_Z;
  const cornerX = sideX * EW_CROSSWALK_X; // corner where the cross-street sidewalk meets the main sidewalk
  const legs: WalkerLeg[] = [
    // 1. Walk the cross-street sidewalk inward to the corner at x = ±14.
    { axis: "x", fixed: fixedZ, start: startX, target: cornerX, crosswalk: false },
  ];
  if (turn) {
    // 2. Move from the sidewalk (z = ±8) down to the EW crosswalk (z = ±4) on the corner.
    legs.push({ axis: "z", fixed: cornerX, start: fixedZ, target: sideZ * INTERSECTION_HALF, crosswalk: false });
    // 3. Cross the cross street on the EW crosswalk (z: ±4 -> ∓4).
    legs.push({ axis: "z", fixed: cornerX, start: sideZ * INTERSECTION_HALF, target: -sideZ * INTERSECTION_HALF, crosswalk: true });
    // 4. Continue along the main sidewalk, away from the intersection, to off-screen.
    legs.push({ axis: "z", fixed: cornerX, start: -sideZ * INTERSECTION_HALF, target: -sideZ * (WRAP_AT.z + WALKER_EXIT_MARGIN), crosswalk: false });
  } else {
    // 2. Move from the sidewalk (z = ±8) down to the NS crosswalk (z = ±4) on the corner.
    legs.push({ axis: "z", fixed: cornerX, start: fixedZ, target: sideZ * INTERSECTION_HALF, crosswalk: false });
    // 3. Cross the main road on the NS crosswalk (x: ±14 -> ∓14) — the visible left/right crossing.
    legs.push({ axis: "x", fixed: sideZ * INTERSECTION_HALF, start: cornerX, target: -cornerX, crosswalk: true });
    // 4. Move back out from the crosswalk (z = ±4) to the far cross-street sidewalk (z = ±8).
    legs.push({ axis: "z", fixed: -cornerX, start: sideZ * INTERSECTION_HALF, target: fixedZ, crosswalk: false });
    // 5. Continue along the far cross-street sidewalk, outward to off-screen.
    legs.push({ axis: "x", fixed: fixedZ, start: -cornerX, target: -sideX * (CROSS_SIDEWALK_FAR + WALKER_EXIT_MARGIN), crosswalk: false });
  }
  return { legs, startPos: [startX, fixedZ] };
}

function faceLeg(w: Walker, leg: WalkerLeg): void {
  const dir = Math.sign(leg.target - leg.start) as 1 | -1;
  w.grp.rotation.y = leg.axis === "z" ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
}

function assignRoute(w: Walker, axis: "z" | "x", sideZ: 1 | -1, sideX: 1 | -1, idx: number): void {
  const { legs, startPos } = routeFor(axis, sideZ, sideX, idx);
  w.legs = legs;
  w.leg = 0;
  w.grp.position.set(startPos[0], 0, startPos[1]);
  const first = legs[0];
  w.needsWalk = legNeedsWalk(first);
  w.walking = !w.needsWalk; // sidewalk legs never wait; a crosswalk leg waits for its signal below
  faceLeg(w, first);
}

function respawn(w: Walker): void {
  const axis = Math.random() < 0.5 ? "z" : "x";
  const sideZ = (Math.random() < 0.5 ? -1 : 1) as 1 | -1;
  const sideX = (Math.random() < 0.5 ? -1 : 1) as 1 | -1;
  const idx = Math.floor(Math.random() * (axis === "z" ? 4 : 2));
  assignRoute(w, axis, sideZ, sideX, idx);
}

function advanceWalker(w: Walker): void {
  w.leg++;
  if (w.leg >= w.legs.length) {
    respawn(w); // reached off-screen — start a fresh route on a fresh sidewalk
    return;
  }
  const leg = w.legs[w.leg];
  w.grp.position[otherAxis(leg.axis)] = leg.fixed; // snap to the new leg's centerline
  w.needsWalk = legNeedsWalk(leg);
  w.walking = !w.needsWalk;
  faceLeg(w, leg);
}

function buildWalker(city: THREE.Group, axis: "z" | "x", sideZ: 1 | -1, sideX: 1 | -1, idx: number): Walker {
  const w: Walker = {
    grp: makePedestrian(city),
    legs: [],
    leg: 0,
    sidewalkSpeed: WALKER_SIDEWALK_SPEED + Math.random() * 0.4,
    crossSpeed: WALKER_CROSS_SPEED + Math.random() * 0.3,
    needsWalk: null,
    walking: false,
  };
  assignRoute(w, axis, sideZ, sideX, idx);
  return w;
}

// Build a balanced set of walkers on both roads (so pedestrians are visible on both axes).
function buildAxisWalkers(city: THREE.Group, axis: "z" | "x", count: number): Walker[] {
  const walkers: Walker[] = [];
  const perCombo = axis === "z" ? 4 : 2; // z uses idx 0..3 (spawn 10..90), x uses idx 0..1 (spawn 20..35)
  const combos: [1 | -1, 1 | -1][] = [[-1, -1], [-1, 1], [1, -1], [1, 1]]; // [sideZ, sideX]
  let c = 0;
  let idx = 0;
  for (let i = 0; i < count; i++) {
    const [sideZ, sideX] = combos[c];
    walkers.push(buildWalker(city, axis, sideZ, sideX, idx));
    idx++;
    if (idx >= perCombo) { idx = 0; c = (c + 1) % combos.length; }
  }
  return walkers;
}

export function buildWalkers(city: THREE.Group): Walker[] {
  return [
    ...buildAxisWalkers(city, "z", WALKER_Z_COUNT),
    ...buildAxisWalkers(city, "x", WALKER_X_COUNT),
  ];
}

export function updateWalkers(walkers: Walker[], phase: SignalPhase, dt: number): void {
  for (const w of walkers) {
    const leg = w.legs[w.leg];
    if (!w.walking) {
      // Waiting at a curb for the walk signal — step off once the window is long enough to finish.
      const need = w.needsWalk;
      if (need) {
        const walkable = need === "ns" ? phase.nsWalk : phase.ewWalk;
        const remaining = need === "ns" ? phase.nsWalkRemaining : phase.ewWalkRemaining;
        const dur = Math.abs(leg.target - leg.start) / w.crossSpeed;
        if (walkable && remaining >= dur + PED_DEPARTURE_MARGIN_S) w.walking = true;
      } else {
        w.walking = true;
      }
    }
    if (!w.walking) continue;

    const dir = Math.sign(leg.target - w.grp.position[leg.axis]) as 1 | -1;
    const speed = leg.crosswalk ? w.crossSpeed : w.sidewalkSpeed;
    const next = w.grp.position[leg.axis] + dir * speed * dt;
    if ((leg.target - next) * dir <= 0) {
      w.grp.position[leg.axis] = leg.target; // arrived
      advanceWalker(w);
    } else {
      w.grp.position[leg.axis] = next;
    }
  }
}

// Everything a car needs to know about walkers currently mid-crosswalk, so updateCars can stop for
// them exactly as it used to stop for the old fixed crosswalk crossers.
export function getCrossingPeds(walkers: Walker[]): { axis: "x" | "z"; fixed: number; moving: boolean }[] {
  const out: { axis: "x" | "z"; fixed: number; moving: boolean }[] = [];
  for (const w of walkers) {
    const leg = w.legs[w.leg];
    if (leg && leg.crosswalk) out.push({ axis: leg.axis, fixed: leg.fixed, moving: w.walking });
  }
  return out;
}
