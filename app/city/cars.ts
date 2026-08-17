import * as THREE from "three";
import { mesh } from "./utils";
import {
  carColors, CAR_LENGTH, CAR_HALF_LENGTH, CAR_MIN_GAP, CAR_DECEL, CAR_ACCEL,
  PED_CLEARANCE, INTERSECTION_HALF, STOP_OFFSET, EW_STOP_OFFSET, WRAP_AT,
} from "./constants";
import type { SignalPhase } from "./signals";
import type { CityHandles } from "./scene-types";
import { getCrossingPeds } from "./pedestrians";

type Axis = "x" | "z";
const otherAxis = (a: Axis): Axis => (a === "x" ? "z" : "x");

// Forward distance from `from` to `to` along `axis` in direction `dir`, treating the road as a loop
// of length 2*WRAP_AT[axis] — so a hazard just past the wrap seam still reads as "close ahead".
function forwardDistance(from: number, to: number, dir: 1 | -1, axis: Axis): number {
  const loop = 2 * WRAP_AT[axis];
  const raw = dir * (to - from);
  return ((raw % loop) + loop) % loop;
}

// `axis` is the road the car travels along ("z" for the main road, "x" for the cross street).
// `laneOffset` is the car's fixed coordinate on the OTHER axis, `startPos` its starting coordinate
// on the travel axis. The model is built facing +z; for axis "x" it's rotated 90° so "forward"
// (headlights leading) points along +x/-x instead.
export function makeCar(city: THREE.Group, dir: 1 | -1, laneOffset: number, startPos: number, axis: Axis = "z") {
  const grp = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, CAR_LENGTH), new THREE.MeshStandardMaterial({ color: carColors[Math.floor(Math.random() * carColors.length)], roughness: 0.4, metalness: 0.6 }));
  body.position.y = 0.45; grp.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 1.2), new THREE.MeshStandardMaterial({ color: 0x101015, roughness: 0.3, metalness: 0.7 }));
  cabin.position.set(0, 0.9, -0.1); grp.add(cabin);
  for (const s of [-1, 1]) grp.add(mesh(new THREE.SphereGeometry(0.08, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffffe0 }), [s * 0.5, 0.5, 1.2]));
  for (const s of [-1, 1]) grp.add(mesh(new THREE.SphereGeometry(0.08, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff2020 }), [s * 0.5, 0.5, -1.2]));

  if (axis === "z") {
    grp.position.set(laneOffset, 0, startPos);
    if (dir < 0) grp.rotation.y = Math.PI;
  } else {
    grp.position.set(startPos, 0, laneOffset);
    grp.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
  }
  grp.userData.dir = dir; grp.userData.axis = axis; grp.userData.speed = 8 + Math.random() * 6;
  grp.userData.followGap = CAR_MIN_GAP + Math.random() * 1.2;
  city.add(grp);
  return grp;
}

// ── Motion model ───────────────────────────────
// Each car's speed is capped so it can stop before the NEAREST thing it must not pass, at a
// comfortable constant CAR_DECEL: v = sqrt(2·DECEL·distance). Every hazard reports its distance
// the same way (positive = ahead), so they all share one braking curve. The hazards are:
//   1. The stop line, when the car's own light is yellow or red (unless already committed past it).
//   2. The car ahead in the same lane (keep a following gap).
//   3. Cross traffic already inside the intersection box (a safety net independent of the signal).
//   4. A pedestrian mid-crossing in a crosswalk on this road.
export function updateCars(cars: THREE.Group[], walkers: CityHandles["walkers"], phase: SignalPhase, dt: number): void {
  // Is any car of the OTHER axis currently inside the intersection's conflict box? One check per
  // axis per frame — every car sharing that axis asks the same question below.
  const boxOccupied: Record<Axis, boolean> = { x: false, z: false };
  for (const c of cars) {
    const a = c.userData.axis as Axis;
    if (Math.abs(c.position[a]) < INTERSECTION_HALF) boxOccupied[otherAxis(a)] = true;
  }
  const crossingPeds = getCrossingPeds(walkers);

  for (const car of cars) {
    const axis = car.userData.axis as Axis;
    const dir = car.userData.dir as 1 | -1;
    const maxSpeed = car.userData.speed as number;
    const pos = car.position[axis];
    const curSpeed: number = car.userData.curSpeed ?? maxSpeed;
    const frontBumper = pos + dir * CAR_HALF_LENGTH;

    // Distance (positive = ahead) to the nearest thing this car must stop before.
    let stopDist = Infinity;
    const consider = (d: number) => { if (d < stopDist) stopDist = d; };

    // 1. Stop line — never enter the intersection on yellow or red. A car whose front bumper is
    // already past the line (committed, entered on green) is allowed to finish its crossing. A car
    // whose front bumper is exactly at the line must also remain stopped, otherwise it would creep
    // forward into the crosswalk / intersection the moment the clamp sets it on the line.
    const light = axis === "z" ? phase.nsLight : phase.ewLight;
    const stopLine = -dir * (axis === "z" ? STOP_OFFSET : EW_STOP_OFFSET);
    const distToLine = (stopLine - frontBumper) * dir;
    if (light !== "green" && distToLine >= 0) consider(distToLine);

    // 2. Car ahead in the same lane — keep followGap (center-to-center) behind it.
    for (const other of cars) {
      if (other === car) continue;
      if (other.userData.axis !== axis || other.userData.dir !== dir) continue;
      const gap = forwardDistance(pos, other.position[axis], dir, axis);
      if (gap > 0) consider(gap - (car.userData.followGap as number));
    }

    // 3. Cross traffic already inside the intersection box — a hard safety net so a straggling car
    // from either road can never physically collide with the other. Only while this car is still on
    // the NEAR side and hasn't entered the box yet (dir*pos < 0 = near side; |pos| >= half = outside).
    if (dir * pos < 0 && Math.abs(pos) >= INTERSECTION_HALF && boxOccupied[axis]) {
      consider(((-dir * INTERSECTION_HALF) - frontBumper) * dir);
    }

    // 4. Pedestrian mid-crossing in a crosswalk on this road — stop short of the crosswalk. Walkers
    // only cross while this road's light is red (their walk signal), so this is a backstop for a
    // walker still finishing when the light turns green — but it guarantees no car ever hits one.
    for (const p of crossingPeds) {
      if (p.axis !== otherAxis(axis)) continue; // p crosses THIS car's road
      if (!p.moving) continue; // waiting at the curb, not in the road
      consider((p.fixed - dir * PED_CLEARANCE - frontBumper) * dir);
    }

    // Speed: brake to stop within stopDist. Braking is uncapped (snap straight to the safe speed —
    // it already encodes CAR_DECEL); accelerating off a stop is capped at CAR_ACCEL.
    const safe = Math.min(maxSpeed, Math.sqrt(2 * CAR_DECEL * Math.max(0, stopDist)));
    const next = safe < curSpeed ? safe : Math.min(safe, curSpeed + CAR_ACCEL * dt);
    car.userData.curSpeed = next;

    let newPos = pos + dir * next * dt;
    // Clamp so the car's center can never pass its nearest stop point (only when that point is
    // ahead) — closes the tiny discrete-time overshoot at large dt (e.g. a tab switch).
    if (stopDist !== Infinity && stopDist > 0 && (pos + dir * stopDist - newPos) * dir < 0) {
      newPos = pos + dir * stopDist;
    }
    // Wrap around the loop. Use a true modulo offset rather than a sign flip so a car that overshoots
    // the boundary doesn't end up outside the loop and oscillate back and forth across it.
    if (Math.abs(newPos) > WRAP_AT[axis]) newPos -= Math.sign(newPos) * 2 * WRAP_AT[axis];
    car.position[axis] = newPos;
  }
}
