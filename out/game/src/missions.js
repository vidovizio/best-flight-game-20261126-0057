// Ember Ridge Airlift — mission system.
// Three mission types: DELIVER cargo to airstrips, RINGS fly through targets, SURVEY photograph landmarks.

import { MISSIONS, WORLD, SCORING } from '../config.js';
import { createRandom } from '../random.js';

export const MISSION_TYPE = {
  DELIVER: 'DELIVER',
  RINGS: 'RINGS',
  SURVEY: 'SURVEY',
};

export function createMissions(seed, terrain, rings) {
  const random = createRandom(seed + 2000);
  const missions = [];
  let activeMission = null;
  let missionIndex = 0;
  let score = 0;
  let timeRemaining = MISSIONS.timeLimit;
  let deliveredCount = 0;
  let ringsPassed = 0;
  let surveyedCount = 0;

  // Create initial missions
  function generateMissions() {
    // Delivery missions - one per airstrip
    for (const strip of terrain.airstrips) {
      missions.push({
        type: MISSION_TYPE.DELIVER,
        targetStrip: strip,
        cargoWeight: MISSIONS.deliverCargoWeight,
        completed: false,
        active: false,
        description: `Deliver supplies to Airstrip ${strip.id + 1}`,
      });
    }

    // Ring mission
    missions.push({
      type: MISSION_TYPE.RINGS,
      rings: rings,
      requiredPasses: Math.ceil(rings.rings.length * 0.6),
      completed: false,
      active: false,
      description: 'Fly through the marker rings',
    });

    // Survey missions - photograph villages
    for (let i = 0; i < 3; i++) {
      const village = terrain.villages[Math.floor(random() * terrain.villages.length)];
      missions.push({
        type: MISSION_TYPE.SURVEY,
        targetVillage: village,
        completed: false,
        active: false,
        description: `Survey village at ${Math.round(village.x)}, ${Math.round(village.z)}`,
      });
    }

    // Shuffle
    for (let i = missions.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [missions[i], missions[j]] = [missions[j], missions[i]];
    }
  }

  function startNextMission() {
    if (missionIndex >= missions.length) return false;
    activeMission = missions[missionIndex];
    activeMission.active = true;
    timeRemaining = MISSIONS.timeLimit;
    return true;
  }

  function update(dt, aircraftState, terrain) {
    if (!activeMission) return { completed: false, scoreChange: 0, message: null };

    timeRemaining -= dt;
    let scoreChange = 0;
    let message = null;
    let completed = false;

    switch (activeMission.type) {
      case MISSION_TYPE.DELIVER: {
        const strip = activeMission.targetStrip;
        const dx = aircraftState.x - strip.x;
        const dz = aircraftState.z - strip.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        // Check landing
        if (aircraftState.onGround && dist < 100 && aircraftState.groundSpeed < 30) {
          if (aircraftState.groundSpeed < 10) {
            scoreChange += SCORING.perfectLandingBonus;
            message = 'Perfect landing! Bonus awarded.';
          } else {
            scoreChange += SCORING.landingBonus;
            message = 'Cargo delivered.';
          }
          scoreChange += SCORING.deliveryBonus;
          activeMission.completed = true;
          completed = true;
          deliveredCount++;
        } else if (dist < 500 && !activeMission.announced) {
          activeMission.announced = true;
          message = `Approaching Airstrip ${strip.id + 1}. Prepare for landing.`;
        }
        break;
      }

      case MISSION_TYPE.RINGS: {
        const result = activeMission.rings.checkPassage(aircraftState.x, aircraftState.y, aircraftState.z);
        if (result.passed > 0) {
          scoreChange += result.points;
          ringsPassed += result.passed;
          message = `Ring passed! +${result.points}`;
        }
        const progress = activeMission.rings.getProgress();
        if (progress.passed >= activeMission.requiredPasses && !activeMission.completed) {
          activeMission.completed = true;
          completed = true;
          message = 'Ring course complete!';
        }
        break;
      }

      case MISSION_TYPE.SURVEY: {
        const village = activeMission.targetVillage;
        const dx = aircraftState.x - village.x;
        const dz = aircraftState.z - village.z;
        const dist = Math.sqrt(dx * dx + dz * dz);

        // Survey when close and at good altitude
        if (dist < 200 && aircraftState.y > 100 && aircraftState.y < 500 && !activeMission.surveyed) {
          activeMission.surveyed = true;
          scoreChange += SCORING.surveyBonus;
          surveyedCount++;
          message = 'Survey photo taken!';
        } else if (dist < 500 && !activeMission.announced) {
          activeMission.announced = true;
          message = `Survey target ahead. Fly overhead at 100-500m altitude.`;
        }

        if (activeMission.surveyed && !activeMission.completed) {
          activeMission.completed = true;
          completed = true;
        }
        break;
      }
    }

    // Time's up
    if (timeRemaining <= 0 && !completed) {
      message = 'Mission time expired.';
      completed = true;
    }

    if (completed) {
      activeMission.active = false;
      missionIndex++;
      const nextStarted = startNextMission();
      if (!nextStarted) {
        activeMission = null;
      } else {
        timeRemaining = MISSIONS.timeLimit;
      }
    }

    return { completed, scoreChange, message, timeRemaining };
  }

  function getActiveMission() {
    return activeMission;
  }

  function getProgress() {
    return {
      current: missionIndex + 1,
      total: missions.length,
      score,
      deliveredCount,
      ringsPassed,
      surveyedCount,
    };
  }

  function addScore(points) {
    score += points;
  }

  function getScore() {
    return score;
  }

  function reset() {
    missions.length = 0;
    activeMission = null;
    missionIndex = 0;
    score = 0;
    timeRemaining = MISSIONS.timeLimit;
    deliveredCount = 0;
    ringsPassed = 0;
    surveyedCount = 0;
    generateMissions();
    startNextMission();
  }

  generateMissions();
  startNextMission();

  return {
    update,
    getActiveMission,
    getProgress,
    addScore,
    getScore,
    reset,
    missions,
  };
}