import * as THREE from "three";
import { lerp } from "./utils";
import {
  INTERSECTION_HALF, EW_CROSSWALK_X, MAIN_SIDEWALK_X, CROSS_SIDEWALK_Z, CROSS_SIDEWALK_FAR,
  MAIN_SIDEWALK_OUTER, SIDEWALK_WIDTH, NS_CROSSWALK_SPAN, EW_CROSSWALK_SPAN, WRAP_AT,
  PED_CROSS_SPEED_NS, PED_CROSS_SPEED_EW, CROSSWALK_HALF_LEN, CAR_HALF_LENGTH, STOP_BUFFER,
} from "./constants";
import type { AxisState } from "./constants";

// Rough pedestrian body clearance, when a stroller is a car hazard outside any marked crosswalk
// (see pedestrianHazardDistance) — not CROSSWALK_HALF_LEN, since that's specifically about painted
// crosswalk width, which doesn't apply here.
const STROLLER_HAZARD_HALF_WIDTH = 0.5;
import type { CityHandles } from "./scene-types";

// Pedestrians — a low-poly figure. Geometry is shared across every instance (only materials
// vary, picked from a small fixed palette) to keep the draw/memory cost of a whole crowd low.
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
  if (Math.random() < 0.3) { // occasional backpack
    const pack = new THREE.Mesh(packGeo, packMat);
    pack.position.set(0, 0.62, -0.16); grp.add(pack);
  }
  grp.scale.setScalar(0.85 + Math.random() * 0.3); // height/build variety
  city.add(grp);
  return grp;
}

// A few dedicated crossers use the crosswalks (NS ones wait for the NS walk signal, EW ones for
// the EW walk signal). Once one finishes a crossing it "graduates" — walks away down the far
// sidewalk and disappears like a stroller, instead of immediately turning around to cross back.
export function buildCrossers(city: THREE.Group): CityHandles["crossers"] {
  return [
    { grp: makePedestrian(city), fixed: -INTERSECTION_HALF, axis: "x", gated: true, t: 0, dir: 1, moving: false, graduated: false, strollDir: 1, strollSpeed: 1 },
    { grp: makePedestrian(city), fixed: INTERSECTION_HALF, axis: "x", gated: true, t: 1, dir: -1, moving: false, graduated: false, strollDir: -1, strollSpeed: 1 },
    { grp: makePedestrian(city), fixed: -EW_CROSSWALK_X, axis: "z", gated: true, t: 0, dir: 1, moving: false, graduated: false, strollDir: 1, strollSpeed: 1 },
    { grp: makePedestrian(city), fixed: EW_CROSSWALK_X, axis: "z", gated: true, t: 1, dir: -1, moving: false, graduated: false, strollDir: -1, strollSpeed: 1 },
  ];
}

// Strollers walk the full length of whichever sidewalk they're on and wrap at WRAP_AT, exactly
// like cars do on their road — both roads get their own population (8 on the longer main-road
// sidewalks, 4 on the shorter cross-street ones, matching the 8-NS/4-EW car split), and both speed
// AND initial spacing are independently randomized per pedestrian so they don't read as a
// mechanically evenly-spaced line.
const STROLLER_MARGIN = 5; // keep initial spawns a bit inside the wrap boundary, not exactly on it
// How far a stroller's lateral position can jitter off its sidewalk's centerline — derived from
// SIDEWALK_WIDTH itself (half of half the sidewalk), not an independent guess, so a pedestrian is
// provably within the sidewalk's actual width (with room to spare) no matter how that width changes.
const STROLLER_LANE_JITTER = SIDEWALK_WIDTH / 4;

export function buildStrollers(city: THREE.Group): CityHandles["strollers"] {
  const strollers: CityHandles["strollers"] = [];
  const addStroller = (axis: "x" | "z", along: number, across: number) => {
    const dir = (Math.random() < 0.5 ? 1 : -1) as 1 | -1;
    const grp = makePedestrian(city);
    if (axis === "z") grp.position.set(across, 0, along);
    else grp.position.set(along, 0, across);
    grp.rotation.y = axis === "z" ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    strollers.push({ grp, axis, dir, speed: 0.9 + Math.random() * 0.7 });
  };
  for (let i = 0; i < 8; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    // Avoid spawning inside the intersection's curb-cut gap (|z| < INTERSECTION_HALF) — a stroller
    // is protected there once actually simulating (see pedestrianHazardDistance below), but
    // materializing already inside it on load reads as popping into traffic rather than walking there.
    const segSign = Math.random() < 0.5 ? 1 : -1;
    const along = segSign * lerp(INTERSECTION_HALF, WRAP_AT.z - STROLLER_MARGIN, Math.random());
    addStroller("z", along, side * MAIN_SIDEWALK_X + (Math.random() - 0.5) * STROLLER_LANE_JITTER);
  }
  for (let i = 0; i < 4; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    // Unlike the main-road sidewalks, the cross-street ones are two disconnected segments (see
    // updateStrollers) — spawn within ONE segment, not across the whole wrap range, or half these
    // spawns would land in the road/empty gap between the segments instead of on a sidewalk.
    const segSign = Math.random() < 0.5 ? 1 : -1;
    const along = segSign * lerp(MAIN_SIDEWALK_OUTER, CROSS_SIDEWALK_FAR - STROLLER_MARGIN, Math.random());
    addStroller("x", along, side * CROSS_SIDEWALK_Z + (Math.random() - 0.5) * STROLLER_LANE_JITTER);
  }
  return strollers;
}

// A crosser starts parked at a curb (t === 0 or 1, moving === false). Gated crossers can only
// LEAVE the curb while their road's signal is walkable (NS crossers use nsWalkable, EW crossers
// use ewWalkable); once moving they always finish the crossing, so a light change mid-walk doesn't
// strand them. On arrival they "graduate": instead of turning around to cross back (which would
// have them bouncing on the road for the whole multi-cycle-long walk window, permanently blocking
// the pedestrian-safety check in tickCity that treats "someone's on the road" as an absolute stop),
// they walk away down the sidewalk they landed on and disappear the same way strollers do — then
// respawn back at their original curb, gated, so the crosswalk keeps getting used indefinitely
// instead of only once per page load.
export function updateCrossers(crossers: CityHandles["crossers"], nsWalkable: boolean, ewWalkable: boolean, dt: number): void {
  // THREE.Clock.getDelta() returns exactly 0 on its very first call (it just starts the clock) —
  // so the animation's first tick ever runs with dt === 0. That's normally harmless (zero elapsed
  // time, zero movement), but a fresh crosser's `t` starts pinned exactly at one arrival boundary
  // (0 or 1 — see buildCrossers), and if they're eligible to leave the curb on that very first frame
  // (true for the EW crossers, since ewWalkable is already true at trafficPhase 0), a zero-progress
  // step still trivially satisfies "t >= 1 || t <= 0" — the check can't tell "just started" from
  // "just arrived" when they're the same value. That "graduates" them before they've taken a single
  // step of the actual crossing walk, and since the normal per-frame position-setting code (which
  // sets their crossing-axis coordinate from `t`) never got to run for them even once, they graduate
  // from wherever their THREE.Group defaulted to (0, 0, 0) — the middle of the intersection — instead
  // of from the crosswalk. A zero-duration frame can't move anyone into a new state; skip it outright.
  if (dt <= 0) return;
  crossers.forEach(p => {
    if (p.graduated) {
      // strollAxis is the OTHER axis from the one they crossed on: an "x"-crossing (main-road)
      // pedestrian now strolls along "z" (the length of the main-road sidewalk), and vice versa.
      // Each must wrap at WRAP_AT for ITS OWN axis, not the other road's — the cross street is much
      // shorter than the main road, so a stroller using the main road's wrap distance here would
      // walk straight off the end of the cross street into empty space before finally turning back.
      const strollAxis = p.axis === "x" ? "z" : "x";
      const strollDistance = p.strollDir * p.strollSpeed * dt;
      p.grp.position[strollAxis] += strollDistance;
      // Once they've walked a full crosswalk-width plus a little clear of the curb, send them back
      // to re-cross: without this, every crosser graduates exactly once per page load and the
      // crosswalk (and its "someone's using it" car-braking check) goes permanently idle after that.
      const RETURN_STROLL_DISTANCE = 6;
      if (Math.abs(p.grp.position[strollAxis]) - Math.abs(p.fixed) > RETURN_STROLL_DISTANCE) {
        p.graduated = false;
        p.moving = false;
        p.t = p.dir > 0 ? 0 : 1; // re-arm at the curb this crosser started from
        return;
      }
      const wrapAt = WRAP_AT[strollAxis];
      if (Math.abs(p.grp.position[strollAxis]) > wrapAt) p.grp.position[strollAxis] = -p.grp.position[strollAxis];
      return;
    }

    const walkable = p.axis === "x" ? nsWalkable : ewWalkable;
    if (!p.moving) {
      const canLeaveCurb = !p.gated || walkable;
      if (canLeaveCurb) p.moving = true;
    }
    if (p.moving) {
      const speed = p.axis === "x" ? PED_CROSS_SPEED_NS : PED_CROSS_SPEED_EW;
      p.t += p.dir * dt * speed;
      if (p.t >= 1 || p.t <= 0) {
        p.t = Math.max(0, Math.min(1, p.t));
        p.moving = false;
        p.graduated = true;
        // p.t is now exactly 0 or 1, so the crossing-axis coordinate they were lerping
        // (NS_CROSSWALK_SPAN / EW_CROSSWALK_SPAN) tells us which side of the road they landed on.
        // That's the crosswalk's own edge, not the sidewalk itself — snap onto the actual sidewalk
        // centerline for that side, or the graduated stroll below walks them down the curb/road
        // edge instead of the sidewalk.
        const arrivedSide = p.t >= 1 ? 1 : -1;
        if (p.axis === "x") p.grp.position.x = arrivedSide * MAIN_SIDEWALK_X;
        else p.grp.position.z = arrivedSide * CROSS_SIDEWALK_Z;
        // p.fixed is the coordinate they were pinned to while crossing (never 0 — it's always
        // ±INTERSECTION_HALF or ±EW_CROSSWALK_X) — its sign points away from the road centerline.
        // Stroll that way, onto the sidewalk; the other way walks straight into traffic.
        p.strollDir = Math.sign(p.fixed) as 1 | -1;
        p.strollSpeed = 0.9 + Math.random() * 0.7;
        p.grp.rotation.y = p.axis === "x"
          ? (p.strollDir > 0 ? 0 : Math.PI)
          : (p.strollDir > 0 ? Math.PI / 2 : -Math.PI / 2);
        return;
      }
    }
    if (p.axis === "x") {
      p.grp.position.set(lerp(-NS_CROSSWALK_SPAN, NS_CROSSWALK_SPAN, p.t), 0, p.fixed);
      p.grp.rotation.y = p.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      p.grp.position.set(p.fixed, 0, lerp(-EW_CROSSWALK_SPAN, EW_CROSSWALK_SPAN, p.t));
      p.grp.rotation.y = p.dir > 0 ? 0 : Math.PI;
    }
  });
}

export function updateStrollers(strollers: CityHandles["strollers"], dt: number): void {
  strollers.forEach(p => {
    p.grp.position[p.axis] += p.dir * p.speed * dt;
    if (p.axis === "z") {
      // The main-road sidewalks really are one continuous run along z (the curb-cut gap at the
      // intersection is right beside them, not a break IN them, since they sit out at
      // MAIN_SIDEWALK_X the whole time) — wrapping by flipping the sign is correct here.
      const wrapAt = WRAP_AT.z;
      if (Math.abs(p.grp.position.z) > wrapAt) p.grp.position.z = -p.grp.position.z;
    } else {
      // The cross-street sidewalks are two DISCONNECTED segments — [MAIN_SIDEWALK_OUTER,
      // CROSS_SIDEWALK_FAR] and its mirror — with the road itself in the gap between them. Flipping
      // the sign on wrap (like the z case) would teleport a stroller across that gap into the
      // opposite segment, through where the road is. Confine each stroller to the segment it's
      // already on: wrap within it, never across the gap.
      const side = Math.sign(p.grp.position.x) || 1;
      if (Math.abs(p.grp.position.x) > CROSS_SIDEWALK_FAR) p.grp.position.x = side * MAIN_SIDEWALK_OUTER;
      else if (Math.abs(p.grp.position.x) < MAIN_SIDEWALK_OUTER) p.grp.position.x = side * CROSS_SIDEWALK_FAR;
    }
  });
}

// A car never needs to react to a pedestrian it's already braking for on general safe-following
// principles — it needs a DISTANCE to the nearest one it might hit, in the same units/frame as the
// signal and leader distances in cars.ts, so all three can be combined with a plain `Math.min` and
// fed through one speed-from-distance formula. No separate "already inside, hold in place" case:
// since the distance below is measured to the car's own FRONT BUMPER (not its center) and clamped
// to zero rather than going negative, `safeSpeed(0) === 0` already means "stop here", covering that
// case for free.
const CAR_CLEARANCE = CAR_HALF_LENGTH + STOP_BUFFER;

// Distance from this car's front bumper to the near edge of a pedestrian-shaped hazard band
// centered at `hazardPos` (the hazard's coordinate on the CAR's own travel axis). `null` — no
// braking constraint — once EITHER the car's rear bumper has cleared the hazard's own (un-padded)
// far edge, OR its front bumper is already past the near edge by the time this hazard is first
// seen. That second case is a genuine dilemma zone: the hazard just went live (a light just turned
// non-green) on a car that was already too close to stop for CAR_DECEL at its current speed —
// exactly the situation PED_CLEARANCE_S exists to make safe, by holding the actual pedestrian back
// long enough for this car to clear. The alternative — flooring the distance at 0 and braking hard
// anyway — doesn't retroactively create stopping room; it just parks the car mid-hazard, which
// looks like it stalled in the middle of the crosswalk instead of completing the crossing it was
// already committed to.
function hazardDistance(dir: 1 | -1, pos: number, hazardPos: number, halfWidth: number): number | null {
  const rearBumper = pos - dir * CAR_HALF_LENGTH;
  const farEdge = hazardPos + dir * halfWidth;
  if ((farEdge - rearBumper) * dir <= 0) return null; // cleared
  const bumper = pos + dir * CAR_HALF_LENGTH;
  const nearEdge = hazardPos - dir * (halfWidth + CAR_CLEARANCE);
  const d = (nearEdge - bumper) * dir;
  return d >= 0 ? d : null; // already past the near edge when first detected — can't stop, so don't try; just finish clearing it
}

// A pedestrian using the PERPENDICULAR crosswalk is a real obstacle to a car, exactly like the car
// ahead of it. Primarily driven by the SIGNAL, not by any individual pedestrian's position or
// timer: a crosser's own walk window is already exactly "my governing state isn't green" (see
// updateCrossers' `walkable`), so a car can know a crosswalk might be in use as far in advance as
// it knows its own light isn't green — including a car already past its OWN (now-red) stop line,
// which signalDistance stops governing entirely the instant it's fully across (see its "cleared"
// case). Without this, THAT car — the one case a real crosswalk-yield is actually needed for — has
// nothing left watching for a pedestrian at all. `|| p.moving` is a backstop for the rare case a
// crossing runs long enough to still be finishing after the light's already cycled back to green —
// "still physically on the crosswalk" always counts as a hazard, signal timing aside.
function crosserDistance(dir: 1 | -1, axis: "x" | "z", pos: number, crossers: CityHandles["crossers"], states: AxisState): number {
  let best = Infinity;
  for (const p of crossers) {
    if (p.axis === axis) continue; // p.axis is the pedestrian's OWN walking axis — a crosser walking axis "x" crosses (is an obstacle to) axis "z" cars, and vice versa
    const governingAxis = p.axis === "x" ? "z" : "x"; // NS crossers (axis "x") gate on the NS state (z); EW crossers (axis "z") gate on the EW state (x)
    if (states[governingAxis] === "green" && !p.moving) continue;
    const d = hazardDistance(dir, pos, p.fixed, CROSSWALK_HALF_LEN);
    if (d !== null && d < best) best = d;
  }
  return best;
}

// How far ahead (in seconds) a stroller's straight-line walk is projected, so an EW car sees one
// about to step off the curb into the cross street's curb-cut gap BEFORE it's actually there —
// same idea as braking for a traffic light that's still green but about to turn, applied to a
// pedestrian instead of a signal. Generous relative to how long a stroller actually takes to cross
// the ~8-unit gap (5-9s at their walking speed): plenty of lead time, and harmless even when
// over-generous, since `safeSpeed` only ever slows a car once it's within its own physics-derived
// stopping distance regardless of how early the hazard itself became "live".
const STROLLER_LOOKAHEAD_S = 3;

// Main-road (NS) strollers walk straight through the intersection's curb-cut gap (there's no
// sidewalk mesh there — see buildRoadway's "split fore/aft of the intersection" sidewalks) at
// their fixed x = ±MAIN_SIDEWALK_X, for the stretch where |z| < INTERSECTION_HALF: that's literally
// the cross street's own paved surface. Unlike crossers, strollers aren't gated by any walk signal
// at all, so without this an EW car has zero reason to ever brake for one — it drives straight
// through. EW strollers never need the equivalent check: they're confined to their own sidewalk
// segments (see updateStrollers) and never enter the main road's band.
function strollerDistance(dir: 1 | -1, axis: "x" | "z", pos: number, strollers: CityHandles["strollers"]): number {
  if (axis !== "x") return Infinity;
  let best = Infinity;
  for (const p of strollers) {
    if (p.axis !== "z") continue;
    const projectedZ = p.grp.position.z + p.dir * p.speed * STROLLER_LOOKAHEAD_S;
    // Neither where they are now nor where they're about to be puts them in the road: not a hazard.
    if (Math.abs(p.grp.position.z) >= INTERSECTION_HALF && Math.abs(projectedZ) >= INTERSECTION_HALF) continue;
    const d = hazardDistance(dir, pos, p.grp.position.x, STROLLER_HAZARD_HALF_WIDTH);
    if (d !== null && d < best) best = d;
  }
  return best;
}

export function pedestrianHazardDistance(dir: 1 | -1, axis: "x" | "z", pos: number, crossers: CityHandles["crossers"], strollers: CityHandles["strollers"], states: AxisState): number {
  return Math.min(crosserDistance(dir, axis, pos, crossers, states), strollerDistance(dir, axis, pos, strollers));
}
