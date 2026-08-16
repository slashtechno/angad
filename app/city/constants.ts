// ── Palette (time-of-day) ───────────────────────
export const palettes = {
  sky: [0x4a3a5e, 0x9aaabe, 0xb0c0d0, 0x8a7a9a, 0x3a3a5e],
  ground: [0x3a3a45, 0x4a4d5a, 0x555862, 0x454655, 0x2a2c35],
  fog: [0x5a4f5e, 0x9aaabe, 0xa5b8c8, 0x7a6a8a, 0x3a3e50],
  sunCol: [0xffaa66, 0xffe0b4, 0xfff8e0, 0xff8a4d, 0x8060a0],
  sunInt: [1.6, 2.0, 2.4, 1.8, 0.7],
  ambCol: [0x6a5a75, 0xaaBabe, 0xc0d0e0, 0x8a7aA0, 0x5a5060],
  ambInt: [0.6, 1.0, 1.2, 0.8, 0.4],
};

export const carColors = [0xff3030, 0x3060ff, 0xffe040, 0xffffff, 0x202020, 0xff8030];
export const signColors = [0xff0080, 0x00d4ff, 0xffaa00, 0xff00ff, 0x00ff88];

// ── Car physics ────────────────────────────────
// A car's `position` is its CENTER. Its speed each frame is capped so it can stop before the
// nearest obstacle at a comfortable constant deceleration: v = sqrt(2·DECEL·distance).
export const CAR_LENGTH = 2.4;
export const CAR_HALF_LENGTH = CAR_LENGTH / 2;
export const CAR_MIN_GAP = CAR_LENGTH + 0.6; // center-to-center following gap (jittered per car)
export const CAR_DECEL = 12; // comfortable braking deceleration, units/s²
export const CAR_ACCEL = 6; // comfortable acceleration off a stop, units/s²
export const STOP_BUFFER = 0.15; // visible clearance a car keeps beyond a stop line / pedestrian
export const PED_CLEARANCE = 0.5; // how far short of a pedestrian's body a car stops

// ── Intersection geometry ───────────────────────
// One intersection at the origin. The main road (NS) runs along z; the cross street (EW) along x.
export const INTERSECTION_HALF = 4; // half-width of the cross street's paved opening
export const MAIN_SIDEWALK_INNER = 10; // inner (curb) edge of the main road's sidewalks
export const EW_LANE = 2; // cross-street lane offset (z), within the ±INTERSECTION_HALF pavement
export const SIDEWALK_WIDTH = 8;
export const MAIN_SIDEWALK_X = 14; // main road sidewalks, centered here on either side
export const CROSS_SIDEWALK_Z = INTERSECTION_HALF + 4; // cross-street sidewalks, centered here
export const CROSS_SIDEWALK_FAR = 30; // far (outer) end of the cross-street sidewalks
export const MAIN_SIDEWALK_OUTER = MAIN_SIDEWALK_X + SIDEWALK_WIDTH / 2;
export const EW_CROSSWALK_X = MAIN_SIDEWALK_X;
export const CROSSWALK_HALF_LEN = 1.2;
export const CROSSWALK_BAR_HALF_WIDTH = 0.35;
const CROSSWALK_EDGE_MARGIN = 0.3;
export const NS_CROSSWALK_SPAN = MAIN_SIDEWALK_INNER - CROSSWALK_EDGE_MARGIN;
export const EW_CROSSWALK_SPAN = INTERSECTION_HALF - CROSSWALK_EDGE_MARGIN;
// Stop lines sit just before each crosswalk, so cars stop short of the crosswalk, not on it.
export const STOP_OFFSET = INTERSECTION_HALF + 2.6; // NS stop lines at z = ±STOP_OFFSET
export const EW_STOP_OFFSET = EW_CROSSWALK_X + 2.6; // EW stop lines at x = ±EW_STOP_OFFSET

// Wrap boundary for anything travelling the full length of a road/sidewalk (cars, strollers).
export const WRAP_AT: Record<"x" | "z", number> = { z: 100, x: 38 };

// ── Signal timing (real-world phase sequence) ───
// NS green → NS yellow → BOTH red (all-red clearance) → EW green → EW yellow → BOTH red → repeat.
// The all-red interval is the delay between one road turning red and the other turning green; it
// also guarantees a car that entered on green has cleared before cross traffic or pedestrians go.
export const SIGNAL_GREEN_S = 10;
export const SIGNAL_YELLOW_S = 2.5;
export const ALL_RED_S = 2.5;
export const NS_GREEN_END_S = SIGNAL_GREEN_S; // NS turns yellow here
export const NS_YELLOW_END_S = NS_GREEN_END_S + SIGNAL_YELLOW_S; // NS turns red here
export const EW_GREEN_START_S = NS_YELLOW_END_S + ALL_RED_S; // EW turns green here (after all-red)
export const EW_GREEN_END_S = EW_GREEN_START_S + SIGNAL_GREEN_S; // EW turns yellow here
export const EW_YELLOW_END_S = EW_GREEN_END_S + SIGNAL_YELLOW_S; // EW turns red here
export const SIGNAL_CYCLE_S = EW_YELLOW_END_S + ALL_RED_S; // NS turns green again here (wraps to 0)

// ── Pedestrian crossing ────────────────────────
// A crosser's walk window is exactly "my road's traffic is stopped AND the all-red gap has passed".
export const PED_CROSS_SPEED_NS = 1 / 7; // fraction/s for the ~22-unit NS crossing — 7s
export const PED_CROSS_SPEED_EW = 1 / 3; // fraction/s for the shorter ~9-unit EW crossing — 3s
// A crosser may only leave the curb if enough of its walk window remains to finish the crossing
// with this much margin — otherwise it would still be mid-crosswalk when the light turns green.
export const PED_DEPARTURE_MARGIN_S = 0.5;

export type SignalState = "red" | "yellow" | "green";
