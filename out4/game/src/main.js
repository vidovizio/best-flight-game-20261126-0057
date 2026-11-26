// Ember Ridge Airlift — main game loop and state machine.
// Boots the simulation, wires input/audio/render, runs fixed-step update.

window.__main_load_start = true;

import { createInput } from './input.js';
window.__input_loaded = true;

import { createAircraft, INSTRUMENT_IDS } from './aircraft.js';
window.__aircraft_loaded = true;

import { createTerrain } from './world/terrain.js';
window.__terrain_loaded = true;

import { createRings } from './world/rings.js';
window.__rings_loaded = true;

import { createMissions, MISSION_TYPE } from './missions.js';
window.__missions_loaded = true;

import { createAudio } from './audio.js';
window.__audio_loaded = true;

import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_OVER, SCREEN_MISSION_COMPLETE } from './render.js';
window.__render_loaded = true;

import { STEP, AIRCRAFT, WORLD, CAMERA, INPUT, MISSIONS } from './config.js';
window.__config_loaded = true;

const canvas = document.getElementById('game');
window.__canvas_ok = true;

const input = createInput(canvas);
window.__input_created = true;

const audio = createAudio();
window.__audio_created = true;

const renderer = createRenderer(canvas);
window.__renderer_created = true;

let screen = SCREEN_TITLE;
window.__vars_initialized = true;
let terrain = null;
let rings = null;
let missions = null;
let aircraft = null;
let lastTime = 0;
let accumulator = 0;
let running = false;
let bestScore = parseInt(localStorage.getItem('emberRidgeBest') || '0', 10);
let finalScore = 0;
let missionsCompleted = 0;
let deliveredCount = 0;
let ringsPassed = 0;
let surveyedCount = 0;
let crashed = false;
let currentMessage = null;

// Parse URL for screenshot mode: ?shot=cover&seed=1
const urlParams = new URLSearchParams(window.location.search);
const shotMode = urlParams.get('shot');
const shotSeed = parseInt(urlParams.get('seed') || '1', 10);

function initGame(seed = null) {
  window.__initGame_called = true;
  const useSeed = seed ?? (Math.floor(Date.now() / 86400000) * 1000 + 42);
  window.__initGame_seed = useSeed;

  terrain = createTerrain(useSeed);
  window.__terrain_created = true;

  rings = createRings(useSeed, terrain);
  window.__rings_created = true;

  missions = createMissions(useSeed, terrain, rings);
  window.__missions_created = true;

  aircraft = createAircraft();
  window.__aircraft_created = true;

  // Start on first airstrip
  const startStrip = terrain.airstrips[0];
  window.__startStrip = startStrip ? 'ok' : 'undefined';

  if (startStrip) {
    const startHeading = startStrip.heading;
    aircraft.reset(startStrip.x, 50, startStrip.z, startHeading);
    window.__aircraft_reset = true;
  } else {
    window.__aircraft_reset = 'no airstrip';
  }

  finalScore = 0;
  missionsCompleted = 0;
  deliveredCount = 0;
  ringsPassed = 0;
  surveyedCount = 0;
  crashed = false;
  window.__initGame_complete = true;
}

function startGame() {
  if (!terrain) initGame();
  screen = SCREEN_PLAY;
  running = true;
  lastTime = performance.now();
  accumulator = 0;
  audio.ensureContext();
}

function handleActions(actions) {
  if (actions & 1) { // PAUSE
    if (screen === SCREEN_PLAY) screen = SCREEN_PAUSED;
    else if (screen === SCREEN_PAUSED) screen = SCREEN_PLAY;
  }
  if (actions & 64) { // RESTART
    if (screen === SCREEN_OVER || screen === SCREEN_MISSION_COMPLETE || screen === SCREEN_TITLE) {
      initGame();
      startGame();
    }
  }
  if (actions & 32) { // CAMERA toggle
    // Could add cockpit view later
  }
}

function update(dt) {
  window.__update_called = true;
  window.__update_dt = dt;
  window.__update_screen = screen;
  window.__update_accumulator_before = accumulator;
  
  if (screen !== SCREEN_PLAY) {
    window.__update_early_return = true;
    return;
  }
  
  window.__update_past_early_return = true;

  // Input
  const rollInput = input.roll() * INPUT.keyboardRoll;
  const pitchInput = input.pitch() * INPUT.keyboardPitch;
  const yawInput = input.yaw();
  const mouse = input.takeMouse();
  const actions = input.takeActions();

  handleActions(actions);

  // Apply mouse input if pointer locked
  if (input.isPointerLocked() && (mouse.x !== 0 || mouse.y !== 0)) {
    aircraft.applyMouseInput(mouse.x, mouse.y, INPUT.mouseSensitivity);
  }

  // Fixed-step simulation
  accumulator += dt;
  window.__update_accumulator_after_add = accumulator;
  let result = null;
  while (accumulator >= STEP) {
    window.__update_while_loop = true;
    result = aircraft.step(STEP, rollInput, pitchInput, yawInput, actions);
    accumulator -= STEP;
    window.__update_accumulator_after_sub = accumulator;

    // Mission update
    if (missions) {
      const mission = missions.getActiveMission();
      if (mission) {
        const aircraftState = aircraft.getState();
        aircraftState.camera = {
          x: aircraftState.x - Math.sin(aircraftState.yaw) * CAMERA.chaseDistance * Math.cos(aircraftState.pitch),
          y: aircraftState.y + CAMERA.chaseHeight,
          z: aircraftState.z - Math.cos(aircraftState.yaw) * CAMERA.chaseDistance * Math.cos(aircraftState.pitch),
          yaw: aircraftState.yaw,
          pitch: aircraftState.pitch - 0.1,
        };
        const missionResult = missions.update(STEP, aircraftState, terrain);
        if (missionResult.message) {
          renderer.addMessage(missionResult.message);
        }
        if (missionResult.scoreChange) {
          finalScore += missionResult.scoreChange;
        }
        if (missionResult.completed) {
          missionsCompleted++;
          if (mission.type === MISSION_TYPE.DELIVER) deliveredCount++;
          else if (mission.type === MISSION_TYPE.RINGS) ringsPassed = mission.rings.getProgress().passed;
          else if (mission.type === MISSION_TYPE.SURVEY) surveyedCount++;
          audio.playMissionComplete();
        }
      }
    }

    // Crash check
    if (result.health <= 0 && !crashed) {
      crashed = true;
      screen = SCREEN_OVER;
      audio.playCrash();
      renderer.triggerShake(1.0);
    }

    // Fuel empty
    if (!result.engineRunning && result.fuel <= 0 && screen === SCREEN_PLAY) {
      screen = SCREEN_OVER;
      audio.playCrash();
    }

    // Check all missions complete
    if (missions && missions.getActiveMission() === null && missions.missions.every(m => m.completed)) {
      screen = SCREEN_MISSION_COMPLETE;
      if (finalScore > bestScore) {
        bestScore = finalScore;
        localStorage.setItem('emberRidgeBest', String(bestScore));
      }
    }
  }
  
  window.__update_while_done = true;
  window.__update_result = result;

  // Update camera for renderer
  const state = aircraft.getState();
  state.camera = {
    x: state.x - Math.sin(state.yaw) * CAMERA.chaseDistance * Math.cos(state.pitch),
    y: state.y + CAMERA.chaseHeight,
    z: state.z - Math.cos(state.yaw) * CAMERA.chaseDistance * Math.cos(state.pitch),
    yaw: state.yaw,
    pitch: state.pitch - 0.1,
  };
  state.terrain = terrain;
  state.rings = rings;
  state.instruments = aircraft.getInstruments();
  state.finalScore = finalScore;
  state.missionsCompleted = missionsCompleted;
  state.deliveredCount = deliveredCount;
  state.ringsPassed = ringsPassed;
  state.surveyedCount = surveyedCount;
  state.crashed = crashed;

  // Audio
  audio.updateEngine(state.airspeed, state.throttle, result?.stalled || false, result?.engineRunning !== false);
  audio.updateWind(state.airspeed);
  audio.updateStall(result?.stalled || false);

  if (actions & 16) audio.playGearSound();
  if (actions & 8) audio.playFlapSound();
}

function loop(time) {
  window.__loop_called = true;
  try {
    const dt = Math.min(0.1, (time - lastTime) / 1000);
    lastTime = time;
  
    update(dt);
  
    const mission = missions?.getActiveMission();
    
    // Build state for renderer - handle title screen where aircraft isn't initialized yet
    let drawState;
    if (aircraft) {
      drawState = aircraft.getState();
      drawState.terrain = terrain;
      drawState.rings = rings;
      drawState.instruments = aircraft.getInstruments();
      drawState.finalScore = finalScore;
      drawState.missionsCompleted = missionsCompleted;
      drawState.deliveredCount = deliveredCount;
      drawState.ringsPassed = ringsPassed;
      drawState.surveyedCount = surveyedCount;
      drawState.crashed = crashed;
    } else if (terrain) {
      // Title screen: show terrain from a fixed camera position
      drawState = {
        x: terrain.airstrips[0]?.x || 0,
        y: 500,
        z: terrain.airstrips[0]?.z || 0,
        yaw: 0,
        pitch: -0.3,
        roll: 0,
        terrain: terrain,
        rings: rings,
        instruments: {},
        finalScore: 0,
        missionsCompleted: 0,
        deliveredCount: 0,
        ringsPassed: 0,
        surveyedCount: 0,
        crashed: false,
      };
    }
    
    if (drawState) {
      renderer.draw(drawState, screen, mission, bestScore);
    }
  
    if (running || screen === SCREEN_TITLE) requestAnimationFrame(loop);
  } catch (e) {
    window.__loop_error = e.message + ' at ' + e.stack;
    console.error('Loop error:', e);
  }
}

function onKeyDown(event) {
  if (screen === SCREEN_TITLE && (event.code === 'Space' || event.code === 'Enter')) {
    event.preventDefault();
    startGame();
  }
}

canvas.addEventListener('click', () => {
  if (screen === SCREEN_TITLE) startGame();
});

window.addEventListener('keydown', onKeyDown);

// Screenshot mode: run one frame and exit
window.__shotMode_block = shotMode;
if (shotMode) {
  window.__shotMode_entered = true;
  initGame(shotSeed);
  screen = SCREEN_PLAY;
  running = false; // Don't loop
  lastTime = performance.now();
  audio.ensureContext();
  
  // Set up specific conditions for each shot type
  if (shotMode === 'cover') {
    // Cover: title screen view - show terrain from above
    screen = SCREEN_TITLE;
  } else if (shotMode === 'delivery') {
    // Delivery: near first airstrip, ready to land
    const strip = terrain.airstrips[0];
    aircraft.reset(strip.x, 80, strip.z + 500, strip.heading);
    aircraft.setThrottle(0.3);
    aircraft.setFlaps(1);
    aircraft.setGear(true);
  } else if (shotMode === 'rings') {
    // Rings: flying through ring course
    if (rings && rings.rings.length > 0) {
      const ring = rings.rings[Math.floor(rings.rings.length / 2)];
      aircraft.reset(ring.x - 200, ring.y + 20, ring.z - 200, 0);
      aircraft.setThrottle(0.7);
    }
  } else if (shotMode === 'survey') {
    // Survey: near a village
    if (terrain && terrain.villages.length > 0) {
      const village = terrain.villages[0];
      aircraft.reset(village.x, 200, village.z + 300, Math.PI / 4);
      aircraft.setThrottle(0.5);
    }
  }
  
  // Run a single update+draw cycle
  try {
    window.__shotMode_before_update = { accumulator, STEP };
    update(STEP);
    window.__shotMode_after_update = { accumulator };
    window.__shotMode_update_done = true;
  } catch (e) {
    window.__shotMode_update_error = e.message + ' at ' + e.stack;
    console.error('Screenshot update error:', e);
  }
  const mission = missions?.getActiveMission();
  window.__shotMode_mission_done = true;
  
  // Build proper drawState like the loop function
  let drawState;
  if (aircraft) {
    drawState = aircraft.getState();
    window.__shotMode_drawState_start = true;
    drawState.camera = {
      x: drawState.x - Math.sin(drawState.yaw) * CAMERA.chaseDistance * Math.cos(drawState.pitch),
      y: drawState.y + CAMERA.chaseHeight,
      z: drawState.z - Math.cos(drawState.yaw) * CAMERA.chaseDistance * Math.cos(drawState.pitch),
      yaw: drawState.yaw,
      pitch: drawState.pitch - 0.1,
    };
    drawState.terrain = terrain;
    drawState.rings = rings;
    drawState.instruments = aircraft.getInstruments();
    drawState.finalScore = finalScore;
    drawState.missionsCompleted = missionsCompleted;
    drawState.deliveredCount = deliveredCount;
    drawState.ringsPassed = ringsPassed;
    drawState.surveyedCount = surveyedCount;
    drawState.crashed = crashed;
    window.__shotMode_drawState_done = true;
  } else if (terrain) {
    window.__shotMode_cover_branch = true;
    // Cover shot: terrain only
    drawState = {
      x: terrain.airstrips[0]?.x || 0,
      y: 500,
      z: terrain.airstrips[0]?.z || 0,
      yaw: 0,
      pitch: -0.3,
      roll: 0,
      camera: { x: 0, y: 500, z: 0, yaw: 0, pitch: -0.3 },
      terrain: terrain,
      rings: rings,
      instruments: {},
      finalScore: 0,
      missionsCompleted: 0,
      deliveredCount: 0,
      ringsPassed: 0,
      surveyedCount: 0,
      crashed: false,
    };
  }
  
  if (drawState) {
    renderer.draw(drawState, screen, mission, bestScore);
    window.__shotMode_draw_done = true;
  }
  
  // Signal completion for Playwright
  window.__screenshot_ready = true;
  window.__screenshot_shot = shotMode;
  window.__screenshot_seed = shotSeed;
} else {
  window.__else_block = true;
  // Initialize game for title screen
  initGame();
  window.__initGame_in_else = true;
  // Start render loop
  requestAnimationFrame(loop);
  window.__raf_started = true;
}

// Expose for debugging and screenshot automation
window.__emberRidge = {
  getState: () => aircraft?.getState(),
  getScreen: () => screen,
  setScreen: (s) => { screen = s; },
  getShotMode: () => shotMode,
  getShotSeed: () => shotSeed,
  getRenderer: () => renderer,
  loop: (time) => loop(time),
};

window.__main_load_complete = true;