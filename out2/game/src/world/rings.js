// Ember Ridge Airlift — target rings for ring missions.
// Rings are placed along flight paths; flying through them scores points.

import { RINGS, WORLD } from '../config.js';
import { createRandom } from '../random.js';

export function createRings(seed, terrain) {
  const random = createRandom(seed + 1000);
  const rings = [];

  // Place rings in a course through the valley
  for (let i = 0; i < RINGS.count; i++) {
    const progress = (i + 1) / (RINGS.count + 1);
    const z = 300 + progress * (WORLD.viewDistance - 600);

    // Vary X position to create a slalom course
    const baseX = Math.sin(progress * Math.PI * 3) * WORLD.viewDistance * 0.25;
    const variation = (random() - 0.5) * 200;
    const x = baseX + variation;

    // Altitude varies to test climb/dive control
    const baseAlt = 200 + Math.sin(progress * Math.PI * 2) * 150;
    const altVariation = (random() - 0.5) * 100;
    const y = Math.max(80, baseAlt + altVariation);

    const colorIdx = i % RINGS.colors.length;
    rings.push({
      x, y, z,
      radius: RINGS.radius,
      thickness: RINGS.thickness,
      color: RINGS.colors[colorIdx],
      passed: false,
      index: i,
    });
  }

  return {
    rings,
    checkPassage(aircraftX, aircraftY, aircraftZ) {
      let passed = 0;
      let points = 0;
      for (const ring of this.rings) {
        if (ring.passed) continue;
        const dx = aircraftX - ring.x;
        const dy = aircraftY - ring.y;
        const dz = aircraftZ - ring.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < ring.radius + 15) {
          ring.passed = true;
          passed++;
          points += RINGS.points;
        }
      }
      return { passed, points };
    },
    reset() {
      for (const ring of this.rings) ring.passed = false;
    },
    getNextRing() {
      for (const ring of this.rings) {
        if (!ring.passed) return ring;
      }
      return null;
    },
    getProgress() {
      let passed = 0;
      for (const ring of this.rings) if (ring.passed) passed++;
      return { passed, total: this.rings.length };
    },
  };
}