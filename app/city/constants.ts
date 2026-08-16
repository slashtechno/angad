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

// A car's `position` is its center, but every stop-line/follow-distance calculation cares about
// where its BUMPER is — without this, "stop at the line" and "leave one car length of gap" were
// both silently measuring from the center, so cars actually stopped/queued half a car length past
// where they looked like they should.
export const CAR_LENGTH = 2.4;
export const CAR_HALF_LENGTH = CAR_LENGTH / 2;
// Bumper-to-bumper (one car length) plus a visible buffer, measured center-to-center — the
// baseline every car's own followGap (see makeCar) jitters around.
export const CAR_MIN_GAP = CAR_LENGTH + 0.6;

// ── Intersection geometry ───────────────────────
// The one real intersection's layout, defined once and shared between scene construction
// (createCity) and the simulation (tickCity) — crosswalk stripes, stop lines, and pedestrian
// walk paths all derive from these same numbers, so they can't quietly drift out of alignment
// with each other the way independently hand-picked literals would.
export const INTERSECTION_HALF = 4; // half-width of the cross street's paved opening
export const MAIN_SIDEWALK_INNER = 10; // inner (curb) edge of the main road's sidewalks — also where the NS crosswalk and NS pedestrian crossing both span to
export const EW_LANE = 2; // cross-street lane offset (z), within the ±INTERSECTION_HALF pavement
export const SIDEWALK_WIDTH = 8; // both sidewalk networks are this wide (perpendicular to their road)
export const MAIN_SIDEWALK_X = 14; // main road sidewalks, centered here on either side
export const CROSS_SIDEWALK_Z = INTERSECTION_HALF + 4; // cross-street sidewalks, centered here on either side
export const CROSS_SIDEWALK_FAR = 30; // far (outer) end of the cross-street sidewalks
// The main sidewalk's outer (far-from-road) edge — where it stops and the cross-street sidewalk
// can safely start without the two boxes overlapping at the corner.
export const MAIN_SIDEWALK_OUTER = MAIN_SIDEWALK_X + SIDEWALK_WIDTH / 2;
export const EW_CROSSWALK_X = MAIN_SIDEWALK_X;
export const CROSSWALK_HALF_LEN = 1.2; // half-length of a crosswalk's zebra-stripe field, across the road it crosses
export const CROSSWALK_BAR_HALF_WIDTH = 0.35; // half-width of an individual zebra-stripe bar
const CROSSWALK_EDGE_MARGIN = 0.3;
// How far each crosswalk's stripe field (and the pedestrian path walking it) reaches from the
// road's centerline — each simply reaches its own sidewalk with a small paint margin.
export const NS_CROSSWALK_SPAN = MAIN_SIDEWALK_INNER - CROSSWALK_EDGE_MARGIN;
export const EW_CROSSWALK_SPAN = INTERSECTION_HALF - CROSSWALK_EDGE_MARGIN;
export const STOP_OFFSET = INTERSECTION_HALF + 2.6; // clears the NS crosswalk band with a buffer, so cars stop short of it, not on it
export const EW_STOP_OFFSET = EW_CROSSWALK_X + 2.6; // clears the EW crosswalk band the same way STOP_OFFSET clears the NS one

// Wrap boundary for anything travelling the full length of a road/sidewalk (cars, strollers).
export const WRAP_AT: Record<"x" | "z", number> = { z: 100, x: 38 };

// ── Signal timing ───────────────────────────────
// Real values, not "equal thirds": NS red must comfortably outlast a full NS pedestrian crossing
// (else pedestrians end up mid-crosswalk after the light's already gone back to green for cars),
// and EW mirrors NS exactly — EW is green+yellow for exactly the SIGNAL_RED_S window NS is red,
// and vice versa, so the two roads are always in complementary phase with no shared green.
export const SIGNAL_GREEN_S = 5;
export const SIGNAL_YELLOW_S = 1.5;
export const SIGNAL_RED_S = 9;
export const SIGNAL_CYCLE_S = SIGNAL_GREEN_S + SIGNAL_YELLOW_S + SIGNAL_RED_S;
export const NS_RED_START_S = SIGNAL_GREEN_S + SIGNAL_YELLOW_S; // NS red (== EW green start) begins here
export const EW_GREEN_S = SIGNAL_RED_S - SIGNAL_YELLOW_S; // fills NS's red window, minus EW's own yellow
export const PED_CROSS_SPEED_NS = 1 / 7; // fraction/s for the ~22-unit NS crossing — 7s, comfortably under SIGNAL_RED_S
export const PED_CROSS_SPEED_EW = 1 / 3; // fraction/s for the shorter ~9-unit EW crossing — 3s, comfortably under NS_RED_START_S
export type SignalState = "red" | "yellow" | "green";
// Looks up the SignalState governing a given road axis (NS uses states.z, EW uses states.x).
export type AxisState = Record<"x" | "z", SignalState>;
