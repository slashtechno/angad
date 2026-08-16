import * as THREE from "three";
import { mesh } from "./utils";
import { carColors, CAR_LENGTH, CAR_HALF_LENGTH, CAR_MIN_GAP, WRAP_AT, CAR_DECEL, CAR_ACCEL, STOP_BUFFER } from "./constants";
import type { AxisState } from "./constants";
import { pedestrianHazardDistance } from "./pedestrians";
import type { CityHandles } from "./scene-types";

// A car's `position` is its center, but every stop-line/follow-distance calculation cares about
// where its BUMPER is — without this, "stop at the line" and "leave one car length of gap" were
// both silently measuring from the center, so cars actually stopped/queued half a car length past
// where they looked like they should (see CAR_LENGTH/CAR_HALF_LENGTH in constants.ts).

// `axis` is which world axis the car travels along ("z" for the main road, "x" for the cross
// street). `laneOffset` is the car's fixed coordinate on the OTHER axis, `startPos` its starting
// coordinate on the travel axis. The model is built facing +z; for axis "x" it's rotated an extra
// 90° so "forward" (headlights leading) points along +x/-x instead.
export function makeCar(city: THREE.Group, dir: 1 | -1, laneOffset: number, startPos: number, axis: "x" | "z" = "z") {
  const grp = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.6, CAR_LENGTH), new THREE.MeshStandardMaterial({ color: carColors[Math.floor(Math.random() * carColors.length)], roughness: 0.4, metalness: 0.6 }));
  body.position.y = 0.45; grp.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 1.2), new THREE.MeshStandardMaterial({ color: 0x101015, roughness: 0.3, metalness: 0.7 }));
  cabin.position.set(0, 0.9, -0.1); grp.add(cabin);
  for (const s of [-1, 1]) grp.add(mesh(new THREE.SphereGeometry(0.08, 6, 6), new THREE.MeshBasicMaterial({ color: 0xffffe0 }), [s * 0.5, 0.5, 1.2]));
  for (const s of [-1, 1]) grp.add(mesh(new THREE.SphereGeometry(0.08, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff2020 }), [s * 0.5, 0.5, -1.2]));

  if (axis === "z") {
    grp.position.set(laneOffset, 0, startPos);
    if (dir < 0) grp.rotation.y = Math.PI; // face -z so headlights lead, tail lights trail
  } else {
    grp.position.set(startPos, 0, laneOffset);
    grp.rotation.y = dir > 0 ? Math.PI / 2 : -Math.PI / 2; // face +x or -x
  }
  grp.userData.dir = dir; grp.userData.axis = axis; grp.userData.speed = 8 + Math.random() * 6;
  // Per-car following gap, jittered around CAR_MIN_GAP — without this every car in a queue settles
  // at the exact same spacing, which reads as mechanically uniform rather than like actual traffic.
  grp.userData.followGap = CAR_MIN_GAP + Math.random() * 1.2;
  city.add(grp);
  return grp;
}

// ── Motion model ─────────────────────────────────
// Every car's speed each frame is derived from ONE number: how far away is the nearest thing it
// must not pass (a red/yellow stop line, the car ahead, a pedestrian in or about to be in its
// path)? At a comfortable deceleration CAR_DECEL, a car doing v needs v²/(2·CAR_DECEL) to stop —
// so capping speed at sqrt(2·CAR_DECEL·distance) means it can never need to overshoot and correct,
// for any obstacle that reports its distance this way. That replaces the old separate
// "start easing off at threshold X, then hard-clamp position so the easing's lag can't overshoot"
// pair PER obstacle type (signal / leader / pedestrian) with one formula shared by all three —
// no clamp functions, no "already past, freeze in place" fallback, no per-obstacle tuning knobs.
function safeSpeed(maxSpeed: number, distance: number): number {
  return Math.min(maxSpeed, Math.sqrt(2 * CAR_DECEL * Math.max(0, distance)));
}

// Distance from this car's front bumper to its stop line, while the light is red or yellow.
// Infinity (no constraint at all) in three cases: it's green; the car's REAR bumper has cleared
// the line (already fully through, committed, no longer this line's concern); or the car's FRONT
// bumper is already past the line the very first frame this constraint applies (the light just
// turned red/yellow under a car that was already too close to stop for CAR_DECEL) — a genuine
// dilemma zone where flooring the distance at 0 wouldn't create stopping room that isn't there, it
// would just park the car straddling its own stop line instead of letting it finish crossing.
function signalDistance(dir: 1 | -1, axis: "x" | "z", pos: number, trafficLights: CityHandles["trafficLights"], states: AxisState): number {
  if (states[axis] === "green") return Infinity;
  const tl = trafficLights.find(t => t.axis === axis && t.dir === dir);
  if (!tl) return Infinity;
  const target = tl.pos - dir * STOP_BUFFER;
  const rearBumper = pos - dir * CAR_HALF_LENGTH;
  if ((target - rearBumper) * dir <= 0) return Infinity; // whole car already past the line
  const bumper = pos + dir * CAR_HALF_LENGTH;
  const d = (target - bumper) * dir;
  return d >= 0 ? d : Infinity;
}

// The road is a LOOP (cars wrap from one end to the other, still travelling the same `dir`), not a
// line — so the raw coordinate difference between two cars is only the real gap between them when
// they're on the same side of the wrap seam. A car near +95 and one near -95 are actually ~10
// units apart going the short way around, not ~190 going the long way — without folding the
// far-apart (long-way) reading back into the near (short-way) one, a car near one end of the road
// picks a car near the OTHER end as its "leader", miles away in raw terms, and paces against it as
// if it were directly, closely ahead.
function wrappedGap(dir: 1 | -1, axis: "x" | "z", pos: number, otherPos: number): number {
  const trackLen = 2 * WRAP_AT[axis];
  let gap = (otherPos - pos) * dir;
  if (gap > trackLen / 2) gap -= trackLen;
  else if (gap <= -trackLen / 2) gap += trackLen;
  return gap;
}

// Distance (center-to-center gap minus this car's own jittered following distance) to the nearest
// car ahead in the same lane. Infinity if there isn't one.
function leaderDistance(c: THREE.Group, dir: 1 | -1, axis: "x" | "z", pos: number, cars: THREE.Group[]): number {
  let bestGap = Infinity;
  for (const other of cars) {
    if (other === c || other.userData.dir !== dir || other.userData.axis !== axis) continue;
    const gap = wrappedGap(dir, axis, pos, other.position[axis]);
    if (gap > 0 && gap < bestGap) bestGap = gap;
  }
  if (bestGap === Infinity) return Infinity;
  return bestGap - (c.userData.followGap as number);
}

export function updateCars(cars: THREE.Group[], trafficLights: CityHandles["trafficLights"], crossers: CityHandles["crossers"], strollers: CityHandles["strollers"], states: AxisState, dt: number): void {
  cars.forEach(c => {
    const dir = c.userData.dir as 1 | -1;
    const axis = c.userData.axis as "x" | "z";
    const maxSpeed = c.userData.speed;
    const pos = c.position[axis];

    const stopDistance = Math.min(
      signalDistance(dir, axis, pos, trafficLights, states),
      leaderDistance(c, dir, axis, pos, cars),
      pedestrianHazardDistance(dir, axis, pos, crossers, strollers, states),
    );

    const target = safeSpeed(maxSpeed, stopDistance);
    const current = c.userData.currentSpeed ?? maxSpeed;
    // Braking is uncapped (snap straight to `target`): it's already the exact speed CAR_DECEL-safe
    // for the current distance, so anything slower is unnecessary caution and anything faster is
    // exactly the overshoot this model exists to avoid. Speeding up off a stop is capped at
    // CAR_ACCEL so it doesn't look like it's snapping straight to full speed.
    c.userData.currentSpeed = target < current ? target : Math.min(target, current + CAR_ACCEL * dt);

    let nextPos = pos + dir * c.userData.currentSpeed * dt;
    // Wrap by shifting a full track-length (2*wrapAt), not by mirroring the sign: `dir` is
    // unchanged across the wrap (this is a loop, a car reappears at the other end still heading
    // the same way), and sign-flipping only coincidentally approximates that for a hair's-width
    // overshoot right at the boundary — for anything further out than that it flips back and forth
    // forever without ever landing back in range.
    const wrapAt = WRAP_AT[axis];
    if (nextPos > wrapAt) nextPos -= 2 * wrapAt;
    else if (nextPos < -wrapAt) nextPos += 2 * wrapAt;
    c.position[axis] = nextPos;
  });
}
