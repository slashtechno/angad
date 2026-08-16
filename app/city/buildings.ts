import * as THREE from "three";
import { mesh } from "./utils";

// ── Roof equipment (water tanks, antennas, AC units) ──
export function addRoofEquipment(city: THREE.Group, x: number, h: number, z: number, w: number, d: number, rng: () => number) {
  const roll = rng();
  if (roll < 0.3) {
    // Water tower
    const tank = new THREE.Mesh(
      new THREE.CylinderGeometry(0.8, 0.8, 1.2, 8),
      new THREE.MeshStandardMaterial({ color: 0x3a3a3e, roughness: 0.8, metalness: 0.2 })
    );
    tank.position.set(x + (rng() - 0.5) * w * 0.3, h + 0.6, z + (rng() - 0.5) * d * 0.3);
    city.add(tank);
    const legs = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.6, 4),
      new THREE.MeshStandardMaterial({ color: 0x222222 })
    );
    legs.position.copy(tank.position); legs.position.y -= 0.9;
    city.add(legs);
  } else if (roll < 0.5) {
    // Antenna array
    const ant = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.03, 3 + rng() * 2, 4),
      new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.6, metalness: 0.4 })
    );
    ant.position.set(x + (rng() - 0.5) * w * 0.3, h + 1.5 + rng(), z);
    city.add(ant);
    // Blinking red light on antenna
    const blink = new THREE.Mesh(
      new THREE.SphereGeometry(0.08, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0xff2222 })
    );
    blink.position.copy(ant.position); blink.position.y += 1.5 + rng();
    blink.userData.blink = true;
    city.add(blink);
  } else if (roll < 0.7) {
    // AC unit cluster
    for (let i = 0; i < 2 + Math.floor(rng() * 3); i++) {
      const unit = new THREE.Mesh(
        new THREE.BoxGeometry(0.8 + rng() * 0.4, 0.4, 0.6 + rng() * 0.3),
        new THREE.MeshStandardMaterial({ color: 0x4a4a4e, roughness: 0.9 })
      );
      unit.position.set(
        x + (rng() - 0.5) * w * 0.4,
        h + 0.2,
        z + (rng() - 0.5) * d * 0.4
      );
      city.add(unit);
    }
  } else if (roll < 0.85) {
    // Rooftop sign / logo block — use BasicMaterial so it glows regardless of lighting
    const signColor = [0xff4060, 0x40a0ff, 0xffa040, 0x40ff90][Math.floor(rng() * 4)];
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(w * 0.4, 0.8, 0.2),
      new THREE.MeshBasicMaterial({ color: signColor })
    );
    sign.position.set(x, h + 0.4, z + d / 2 + 0.1);
    city.add(sign);
  }
}

// ── Building ────────────────────────────────────
export function addBuilding(city: THREE.Group, mats: THREE.MeshStandardMaterial[], x: number, z: number, w: number, h: number, d: number, matIdx: number, rng: () => number) {
  const style = rng();
  const mat = mats[matIdx % mats.length];

  if (style < 0.25) {
    // Setback tower — multiple stacked boxes shrinking upward
    const tiers = 2 + Math.floor(rng() * 3);
    let curY = 0, curW = w, curD = d;
    for (let i = 0; i < tiers; i++) {
      const tierH = h / tiers * (0.8 + rng() * 0.4);
      const geo = new THREE.BoxGeometry(curW, tierH, curD);
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, curY + tierH / 2, z);
      m.castShadow = true; m.receiveShadow = true;
      city.add(m);
      curY += tierH;
      curW *= 0.7 + rng() * 0.15;
      curD *= 0.7 + rng() * 0.15;
    }
    addRoofEquipment(city, x, curY, z, curW, curD, rng);
  } else if (style < 0.4) {
    // Cylindrical tower
    const radius = Math.min(w, d) / 2;
    const geo = new THREE.CylinderGeometry(radius, radius * 1.1, h, 12);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, h / 2, z);
    m.castShadow = true; m.receiveShadow = true;
    city.add(m);
    addRoofEquipment(city, x, h, z, w, d, rng);
  } else if (style < 0.55) {
    // Pyramidal roof — box + cone
    const roofH = h * 0.25;
    const bodyH = h - roofH;
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, bodyH, d), mat);
    body.position.set(x, bodyH / 2, z);
    body.castShadow = true; body.receiveShadow = true;
    city.add(body);
    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(Math.max(w, d) * 0.7, roofH, 4),
      new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.8 })
    );
    roof.position.set(x, bodyH + roofH / 2, z);
    roof.rotation.y = Math.PI / 4;
    roof.castShadow = true;
    city.add(roof);
  } else {
    // Standard box with edge wireframe
    const geo = new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, h / 2, z);
    m.castShadow = true; m.receiveShadow = true;
    city.add(m);
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color: 0x6080a0, transparent: true, opacity: 0.15 })
    );
    edges.position.copy(m.position);
    city.add(edges);
    addRoofEquipment(city, x, h, z, w, d, rng);
  }
}
