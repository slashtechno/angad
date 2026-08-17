import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import {
  INTERSECTION_HALF, MAIN_SIDEWALK_INNER, SIDEWALK_WIDTH, MAIN_SIDEWALK_X, CROSS_SIDEWALK_Z,
  CROSS_SIDEWALK_FAR, MAIN_SIDEWALK_OUTER, EW_CROSSWALK_X, CROSSWALK_HALF_LEN, CROSSWALK_BAR_HALF_WIDTH,
  NS_CROSSWALK_SPAN, EW_CROSSWALK_SPAN, STOP_OFFSET, EW_STOP_OFFSET,
} from "./constants";

// Clear the cross-street sidewalks (which reach to z = ±(INTERSECTION_HALF + 8))
export const BUILDING_GAP = INTERSECTION_HALF + 8;

// Builds the road surface, sidewalks, center-line stripes, stop lines, and crosswalk zebra bars
// for the one intersection (main N-S road + a single perpendicular E-W cross street). Mutates
// `city` directly; returns the shared road material so callers can retint it per time-of-day.
export function buildRoadway(city: THREE.Group): { roadMat: THREE.MeshStandardMaterial } {
  // Road
  const roadGeo = new THREE.PlaneGeometry(80, 200); roadGeo.rotateX(-Math.PI / 2);
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x1a1c22, roughness: 0.9, metalness: 0.0 });
  const road = new THREE.Mesh(roadGeo, roadMat); road.position.y = 0.01; road.receiveShadow = true; city.add(road);

  // Sidewalks (main N-S road) — split fore/aft of the intersection so the cross street has a curb cut
  const swMat = new THREE.MeshStandardMaterial({ color: 0x55585f, roughness: 0.85, metalness: 0.0 });

  // Stripes, stop lines, and crosswalk zebra bars are all static ground decals that never move or
  // change independently once placed — dozens of separate Meshes for them is dozens of draw calls
  // for no visual benefit over one merged mesh per material. Each loop below builds pre-transformed
  // (rotated + translated into final position) geometries and merges them at the end instead of
  // creating a Mesh per bar.
  const stripeGeos: THREE.BufferGeometry[] = [];
  for (let i = -95; i < 95; i += 3) {
    if (Math.abs(i) < INTERSECTION_HALF + 1) continue;
    const g = new THREE.PlaneGeometry(0.15, 1.5);
    g.rotateX(-Math.PI / 2); g.translate(0, 0.02, i);
    stripeGeos.push(g);
  }
  for (const side of [-1, 1]) {
    for (const [zStart, zEnd] of [[-100, -INTERSECTION_HALF], [INTERSECTION_HALF, 100]]) {
      const len = zEnd - zStart;
      const sw = new THREE.Mesh(new THREE.BoxGeometry(SIDEWALK_WIDTH, 0.15, len), swMat);
      sw.position.set(side * MAIN_SIDEWALK_X, 0.075, zStart + len / 2); sw.receiveShadow = true; city.add(sw);
    }
  }

  // Cross street — a single perpendicular road through the one intersection
  const crossRoadGeo = new THREE.PlaneGeometry(80, INTERSECTION_HALF * 2); crossRoadGeo.rotateX(-Math.PI / 2);
  const crossRoad = new THREE.Mesh(crossRoadGeo, roadMat); crossRoad.position.y = 0.012; crossRoad.receiveShadow = true; city.add(crossRoad);
  for (let i = -35; i < 35; i += 3) {
    if (Math.abs(i) < EW_CROSSWALK_X + CROSSWALK_HALF_LEN + 1) continue; // stop clear of the main road AND the EW crosswalk band; the EW crosswalk sits further out than the main road, so clearing it subsumes clearing the main road too
    const g = new THREE.PlaneGeometry(1.5, 0.15);
    g.rotateX(-Math.PI / 2); g.translate(i, 0.02, 0);
    stripeGeos.push(g);
  }
  const stripeMat = new THREE.MeshBasicMaterial({ color: 0xfcc419 }); // yellow center line (US-style opposing-traffic divider)
  city.add(new THREE.Mesh(mergeGeometries(stripeGeos), stripeMat));

  // Stop lines and crosswalk zebra bars — solid/striped white-ish markings, all one material, so
  // they're collected into one merged geometry (roadMarkingGeos) and added as a single mesh below.
  const roadMarkingMat = new THREE.MeshBasicMaterial({ color: 0xd8dae0 });
  const roadMarkingGeos: THREE.BufferGeometry[] = [];

  // Stop lines — solid bars just before each crosswalk, edge-to-edge across the road, where cars
  // actually stop. Both roads get one: the main road (spanning its full sidewalk-to-sidewalk
  // width) and the cross street (spanning its own, narrower, pavement width).
  for (const z of [-STOP_OFFSET, STOP_OFFSET]) {
    const g = new THREE.PlaneGeometry(MAIN_SIDEWALK_INNER * 2, 0.35);
    g.rotateX(-Math.PI / 2); g.translate(0, 0.021, z);
    roadMarkingGeos.push(g);
  }
  for (const x of [-EW_STOP_OFFSET, EW_STOP_OFFSET]) {
    const g = new THREE.PlaneGeometry(0.35, INTERSECTION_HALF * 2);
    g.rotateX(-Math.PI / 2); g.translate(x, 0.021, 0);
    roadMarkingGeos.push(g);
  }

  // Cross-street sidewalks — perpendicular sidewalks either side of the cross street, near the
  // corner. Start at MAIN_SIDEWALK_OUTER, not MAIN_SIDEWALK_INNER: the main sidewalk already
  // covers the corner square between the two roads (it runs the full width of both), so starting
  // here instead of at the road's near edge would double-cover that square with two overlapping
  // boxes instead of meeting it edge-to-edge.
  for (const side of [-1, 1]) {
    for (const [xStart, xEnd] of [[-CROSS_SIDEWALK_FAR, -MAIN_SIDEWALK_OUTER], [MAIN_SIDEWALK_OUTER, CROSS_SIDEWALK_FAR]]) {
      const len = xEnd - xStart;
      const sw = new THREE.Mesh(new THREE.BoxGeometry(len, 0.15, SIDEWALK_WIDTH), swMat);
      sw.position.set(xStart + len / 2, 0.075, side * CROSS_SIDEWALK_Z); sw.receiveShadow = true; city.add(sw);
    }
  }

  // Crosswalks — all four sides of the intersection, each connecting adjacent sidewalk segments.
  // Bars span ±NS_CROSSWALK_SPAN / ±EW_CROSSWALK_SPAN — the SAME extents updateWalkers (in
  // pedestrians.ts) walks pedestrians across, so the stripes and the footpath can't drift apart
  // the way independently-picked numbers would (which is exactly how they drifted apart before).
  // Bar count/stride: stride evenly divides the span so bars land flush at both edges instead of
  // truncating with a visible gap on one side.
  const addCrosswalkNS = (z: number) => { // crosses the main road; rungs run along z, spread across x
    const barCount = Math.max(2, Math.round((NS_CROSSWALK_SPAN * 2) / 1.6) + 1);
    const stride = (NS_CROSSWALK_SPAN * 2) / (barCount - 1);
    for (let i = 0; i < barCount; i++) {
      const x = -NS_CROSSWALK_SPAN + i * stride;
      const g = new THREE.PlaneGeometry(CROSSWALK_BAR_HALF_WIDTH * 2, CROSSWALK_HALF_LEN * 2);
      g.rotateX(-Math.PI / 2); g.translate(x, 0.022, z);
      roadMarkingGeos.push(g);
    }
  };
  const addCrosswalkEW = (x: number) => { // crosses the cross street; rungs run along x, spread across z
    const barCount = Math.max(2, Math.round((EW_CROSSWALK_SPAN * 2) / 1.6) + 1);
    const stride = (EW_CROSSWALK_SPAN * 2) / (barCount - 1);
    for (let i = 0; i < barCount; i++) {
      const z = -EW_CROSSWALK_SPAN + i * stride;
      const g = new THREE.PlaneGeometry(CROSSWALK_HALF_LEN * 2, CROSSWALK_BAR_HALF_WIDTH * 2);
      g.rotateX(-Math.PI / 2); g.translate(x, 0.022, z);
      roadMarkingGeos.push(g);
    }
  };
  addCrosswalkNS(-INTERSECTION_HALF);
  addCrosswalkNS(INTERSECTION_HALF);
  addCrosswalkEW(-EW_CROSSWALK_X);
  addCrosswalkEW(EW_CROSSWALK_X);
  city.add(new THREE.Mesh(mergeGeometries(roadMarkingGeos), roadMarkingMat));

  return { roadMat };
}
