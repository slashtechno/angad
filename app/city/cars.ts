import * as THREE from "three";
import { mesh, lerp } from "./utils";
import { carColors, CAR_LENGTH, CAR_HALF_LENGTH, CAR_MIN_GAP, WRAP_AT } from "./constants";
import type { AxisState } from "./constants";
import { pedestrianHazardStop } from "./pedestrians";
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

const CAR_STOP_DIST = 4; // units before the stop line where cars start braking
const CAR_FOLLOW_DIST = 3.5; // units behind the car ahead where we start braking
const CAR_STOP_DEADZONE = CAR_HALF_LENGTH + 0.3; // within this distance of the line on red, target speed is exactly 0, not just asymptotically close — measured to the bumper, not the car's center

function carTargetSpeedForSignal(dir: 1 | -1, axis: "x" | "z", pos: number, maxSpeed: number, trafficLights: CityHandles["trafficLights"], states: AxisState): number {
  let targetSpeed = maxSpeed;
  const state = states[axis];
  for (const tl of trafficLights) {
    if (tl.axis !== axis || tl.dir !== dir) continue;
    const d = (tl.pos - pos) * dir; // positive if the stop line is still ahead
    if (d > 0 && d < CAR_STOP_DIST + 2) {
      if (state === "red") {
        // A pure 1 - d/window ramp only approaches 0 asymptotically, never quite reaching it —
        // a stopped car's target speed would sit at some tiny-but-nonzero value forever, creeping
        // forward every frame and getting yanked back by clampAtStopLine's hard clamp: visible
        // jitter. Snapping to a real, exact 0 once inside the deadzone removes the creep entirely.
        const brake = d < CAR_STOP_DEADZONE ? 1 : Math.max(0, 1 - d / (CAR_STOP_DIST + 2));
        targetSpeed = Math.min(targetSpeed, maxSpeed * (1 - brake));
      } else if (state === "yellow") {
        targetSpeed = Math.min(targetSpeed, maxSpeed * 0.3);
      }
      // green — go at full speed
    }
  }
  return targetSpeed;
}

function carTargetSpeedForTraffic(c: THREE.Group, dir: 1 | -1, axis: "x" | "z", pos: number, maxSpeed: number, cars: THREE.Group[]): number {
  let gapAhead = Infinity;
  for (const other of cars) {
    if (other === c || other.userData.dir !== dir || other.userData.axis !== axis) continue;
    const d = (other.position[axis] - pos) * dir; // positive if other is ahead
    if (d > 0 && d < gapAhead) gapAhead = d;
  }
  if (gapAhead >= CAR_FOLLOW_DIST) return maxSpeed;
  const minGap = c.userData.followGap as number;
  // Clamped to [0, 1]: without the clamp, a gap tighter than minGap (e.g. from one frame of lag
  // before clampBehindLeader below catches it) drives brake past 1, which flips target speed
  // negative — the car visibly reverses into the one behind it, "bouncing" the queue apart.
  const brake = Math.min(1, Math.max(0, 1 - (gapAhead - minGap) / (CAR_FOLLOW_DIST - minGap)));
  return maxSpeed * (1 - brake);
}

function carTargetSpeedForPedestrian(dir: 1 | -1, axis: "x" | "z", pos: number, maxSpeed: number, crossers: CityHandles["crossers"], strollers: CityHandles["strollers"]): number {
  const stopAt = pedestrianHazardStop(dir, axis, pos, crossers, strollers);
  if (stopAt === null) return maxSpeed;
  const d = Math.max(0, (stopAt - pos) * dir); // 0 when already at/past the stop point (inside the band) — brake fully, not just "close"
  if (d >= CAR_STOP_DIST + 2) return maxSpeed;
  const brake = d < CAR_STOP_DEADZONE ? 1 : Math.max(0, 1 - d / (CAR_STOP_DIST + 2));
  return maxSpeed * (1 - brake);
}

// Both clamps below share one shape: given a hard stop position `stopAt`, never let `nextPos`
// advance past it — UNLESS `pos` (last frame's actual position) is already past it, in which case
// this car is already committed/in transit and out of this clamp's jurisdiction (some other check —
// clampBehindLeader, or simply nothing, if it legitimately cleared the obstacle — governs it now).
// Critically, "past it" and "the clamp target" must be the SAME threshold. An earlier version
// gated on the painted stop-line position but snapped back to a point behind it (to account for the
// car's own length); that gap let a car already snapped to the queue position creep forward one
// tiny step at a time — each step alone too small to trigger "wouldCross the painted line" — before
// finally reaching the line and snapping back, over and over, instead of just staying put.
function clampAtStop(dir: 1 | -1, pos: number, nextPos: number, stopAt: number): number {
  // Strict "<": a car sitting exactly AT stopAt (the normal steady state once queued) must stay
  // clamped every frame, not be waved through as "already past" the instant it reaches the point.
  const alreadyPast = (stopAt - pos) * dir < 0;
  if (alreadyPast) return nextPos;
  const wouldPass = (stopAt - nextPos) * dir < 0;
  return wouldPass ? stopAt : nextPos;
}

function clampAtPedestrian(dir: 1 | -1, axis: "x" | "z", pos: number, nextPos: number, crossers: CityHandles["crossers"], strollers: CityHandles["strollers"]): number {
  const stopAt = pedestrianHazardStop(dir, axis, pos, crossers, strollers);
  return stopAt === null ? nextPos : clampAtStop(dir, pos, nextPos, stopAt);
}

// On red, clamp a car's position so it can never be nudged across its stop line by the speed
// easing above — this is what actually keeps cars off the crosswalk while pedestrians use it.
function clampAtStopLine(dir: 1 | -1, axis: "x" | "z", pos: number, nextPos: number, trafficLights: CityHandles["trafficLights"], states: AxisState): number {
  if (states[axis] !== "red") return nextPos;
  for (const tl of trafficLights) {
    if (tl.axis !== axis || tl.dir !== dir) continue;
    return clampAtStop(dir, pos, nextPos, tl.pos - dir * (CAR_HALF_LENGTH + 0.15));
  }
  return nextPos;
}

// The speed easing in carTargetSpeedForTraffic slows a follower down, but easing alone can still
// let it drift closer than CAR_MIN_GAP for a frame or two (the same lag clampAtStopLine exists to
// cover). This is the hard floor under that: a follower's position can never pass "leader minus
// followGap", full stop — the actual fix for cars bouncing into the one ahead of them.
function clampBehindLeader(c: THREE.Group, dir: 1 | -1, axis: "x" | "z", pos: number, nextPos: number, cars: THREE.Group[]): number {
  let leaderPos: number | null = null;
  let bestGap = Infinity;
  for (const other of cars) {
    if (other === c || other.userData.dir !== dir || other.userData.axis !== axis) continue;
    const gap = (other.position[axis] - pos) * dir;
    if (gap > 0 && gap < bestGap) { bestGap = gap; leaderPos = other.position[axis]; }
  }
  if (leaderPos === null) return nextPos;
  const maxPos = leaderPos - dir * (c.userData.followGap as number);
  const wouldPassLeader = (maxPos - nextPos) * dir < 0;
  return wouldPassLeader ? maxPos : nextPos;
}

export function updateCars(cars: THREE.Group[], trafficLights: CityHandles["trafficLights"], crossers: CityHandles["crossers"], strollers: CityHandles["strollers"], states: AxisState, dt: number): void {
  cars.forEach(c => {
    const dir = c.userData.dir as 1 | -1;
    const axis = c.userData.axis as "x" | "z";
    const maxSpeed = c.userData.speed;
    const pos = c.position[axis];
    const targetSpeed = Math.max(0, Math.min(
      carTargetSpeedForSignal(dir, axis, pos, maxSpeed, trafficLights, states),
      carTargetSpeedForTraffic(c, dir, axis, pos, maxSpeed, cars),
      carTargetSpeedForPedestrian(dir, axis, pos, maxSpeed, crossers, strollers),
    ));
    c.userData.currentSpeed = lerp(c.userData.currentSpeed ?? maxSpeed, targetSpeed, dt * 2.2); // gentler than dt*4 — noticeably abrupt braking read as cars "slamming" to a stop
    let nextPos = pos + dir * c.userData.currentSpeed * dt;
    nextPos = clampAtStopLine(dir, axis, pos, nextPos, trafficLights, states);
    nextPos = clampAtPedestrian(dir, axis, pos, nextPos, crossers, strollers);
    nextPos = clampBehindLeader(c, dir, axis, pos, nextPos, cars);
    const wrapAt = WRAP_AT[axis];
    c.position[axis] = Math.abs(nextPos) > wrapAt ? -nextPos : nextPos;
  });
}
