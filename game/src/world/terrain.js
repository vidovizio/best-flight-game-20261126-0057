// Ember Ridge Airlift — procedural terrain generation.
// Creates a valley with mountains, a winding river, villages, and airstrips.
// Deterministic from a seed; no allocations after createTerrain returns.

import { WORLD, FIELD } from '../config.js';
import { createRandom } from '../random.js';

export function createTerrain(seed) {
  const random = createRandom(seed);
  const segments = [];
  const mountains = [];
  const river = [];
  const villages = [];
  const airstrips = [];

  // Generate mountain ridges (far, mid, near layers)
  for (let layer = 0; layer < 3; layer++) {
    const count = WORLD.mountainCount + layer * 2;
    for (let i = 0; i < count; i++) {
      const x = random() * WORLD.viewDistance * 1.5 - WORLD.viewDistance * 0.25;
      const baseY = WORLD.mountainHeightRange[0] + random() * (WORLD.mountainHeightRange[1] - WORLD.mountainHeightRange[0]);
      const width = WORLD.mountainWidthRange[0] + random() * (WORLD.mountainWidthRange[1] - WORLD.mountainWidthRange[0]);
      const color = layer === 0 ? WORLD.mountainFar : layer === 1 ? WORLD.mountainMid : WORLD.mountainNear;
      const parallax = 0.3 + layer * 0.25;
      mountains.push({ x, baseY, width, color, parallax, seed: random() * 1000 });
    }
  }

  // Generate river path (winding through valley)
  let riverX = 0;
  for (let z = -200; z < WORLD.viewDistance + 200; z += 40) {
    riverX += (random() - 0.5) * WORLD.riverMeander;
    riverX = Math.max(-FIELD.width * 0.4, Math.min(FIELD.width * 0.4, riverX));
    const width = WORLD.riverWidth * (0.7 + random() * 0.6);
    river.push({ z, x: riverX, width });
  }

  // Generate villages along river
  for (let i = 0; i < WORLD.villageCount; i++) {
    const idx = Math.floor(random() * (river.length - 10)) + 5;
    const r = river[idx];
    const side = random() > 0.5 ? 1 : -1;
    const offset = 120 + random() * 200;
    villages.push({
      x: r.x + side * offset,
      z: r.z,
      size: WORLD.villageSize * (0.8 + random() * 0.4),
      buildingCount: 3 + Math.floor(random() * 4),
      seed: random() * 1000,
    });
  }

  // Generate airstrips (flat areas near villages or clearings)
  for (let i = 0; i < WORLD.airstripCount; i++) {
    let placed = false;
    for (let attempt = 0; attempt < 50 && !placed; attempt++) {
      const z = 500 + random() * (WORLD.viewDistance - 1000);
      const x = (random() - 0.5) * FIELD.width * 0.5;
      // Check not too close to mountains (only near mountains with parallax > 0.5)
      let clear = true;
      for (const m of mountains) {
        if (m.parallax > 0.5 && Math.abs(m.x - x) < m.width * 0.5 && Math.abs(m.baseY) > 100) {
          clear = false;
          break;
        }
      }
      // Check not in river
      for (const r of river) {
        if (Math.abs(r.z - z) < 100 && Math.abs(r.x - x) < r.width + 100) {
          clear = false;
          break;
        }
      }
      if (clear) {
        const heading = random() > 0.5 ? 0 : Math.PI;
        airstrips.push({
          x, z,
          length: WORLD.airstripLength,
          width: WORLD.airstripWidth,
          heading,
          id: i,
        });
        placed = true;
      }
    }
    // Fallback: if still not placed, put at a safe default position
    if (!placed) {
      const fallbackZ = 1000 + i * 800;
      const fallbackX = (i % 2 === 0 ? -1 : 1) * 200;
      const heading = i % 2 === 0 ? 0 : Math.PI;
      airstrips.push({
        x: fallbackX,
        z: fallbackZ,
        length: WORLD.airstripLength,
        width: WORLD.airstripWidth,
        heading,
        id: i,
      });
    }
  }

  // Generate ground segments (for collision and visual)
  for (let z = -200; z < WORLD.viewDistance + 200; z += WORLD.segmentLength) {
    let height = 0;
    // Sample mountains for ground height
    for (const m of mountains) {
      if (m.parallax > 0.5) continue; // Only near mountains affect ground
      const dx = m.x;
      const dist = Math.sqrt(dx * dx + (z - m.baseY * 0.3) * (z - m.baseY * 0.3));
      if (dist < m.width) {
        const factor = 1 - dist / m.width;
        height = Math.max(height, m.baseY * factor * 0.3);
      }
    }
    segments.push({ z, height });
  }

  return {
    mountains,
    river,
    villages,
    airstrips,
    segments,
    // Helper: get ground height at world position
    getGroundHeight(x, z) {
      let h = 0;
      for (const m of this.mountains) {
        if (m.parallax > 0.5) continue;
        const dx = x - m.x;
        const dz = z - m.baseY * 0.3;
        const dist = Math.sqrt(dx * dx + dz * dz);
        if (dist < m.width) {
          const factor = 1 - dist / m.width;
          h = Math.max(h, m.baseY * factor * 0.3);
        }
      }
      return h;
    },
    // Helper: check if position is over airstrip
    getAirstripAt(x, z) {
      for (const a of this.airstrips) {
        const localX = (x - a.x) * Math.cos(-a.heading) - (z - a.z) * Math.sin(-a.heading);
        const localZ = (x - a.x) * Math.sin(-a.heading) + (z - a.z) * Math.cos(-a.heading);
        if (Math.abs(localX) < a.width * 0.5 && Math.abs(localZ) < a.length * 0.5) {
          return a;
        }
      }
      return null;
    },
  };
}