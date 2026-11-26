// Ember Ridge Airlift — main game loop and state machine.
// Boots the simulation, wires input/audio/render, runs fixed-step update.

import { createInput } from './input.js';
import { createAircraft, INSTRUMENT_IDS } from './aircraft.js';
import { createTerrain } from './world/terrain.js';
import { createRings } from './world/rings.js';
import { createMissions, MISSION_TYPE } from './missions.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_OVER, SCREEN_MISSION_COMPLETE } from './render.js';
import { STEP, AIRCRAFT, WORLD, CAMERA, INPUT, MISSIONS } from './config.js';

const canvas = document.getElementById('game');
const input = createInput(canvas);
const audio = createAudio();
const renderer = createRenderer(canvas);

let screen = SCREEN_TITLE;
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

function initGame() {
  // Deterministic seed from date for daily variation, but consistent per session
  const seed = Math.floor(Date.now() / 86400000) * 1000 + 42;

  terrain = createTerrain(seed);
  rings = createRings(seed, terrain);
  missions = createMissions(seed, terrain, rings);
  aircraft = createAircraft();

  // Start on first airstrip
  const startStrip = terrain.airstrips[0];
  const startHeading = startStrip.heading;
  aircraft.reset(startStrip.x, 50, startStrip.z, startHeading);

  finalScore = 0;
  missionsCompleted = 0;
  deliveredCount = 0;
  ringsPassed = 0;
  surveyedCount = 0;
  crashed = false;
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
  if (screen !== SCREEN_PLAY) return;

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
  while (accumulator >= STEP) {
    const result = aircraft.step(STEP, rollInput, pitchInput, yawInput, actions);
    accumulator -= STEP;

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
  const dt = Math.min(0.1, (time - lastTime) / 1000);
  lastTime = time;

  update(dt);

  const mission = missions?.getActiveMission();
  renderer.draw(aircraft.getState(), screen, mission, bestScore);

  if (running) requestAnimationFrame(loop);
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

// Start render loop
requestAnimationFrame(loop);

// Expose for debugging
window.__emberRidge = {
  getState: () => aircraft?.getState(),
  getScreen: () => screen,
  setScreen: (s) => { screen = s; },
};