// Ember Ridge Airlift — keyboard and mouse input.
// Held keys give continuous control; mouse gives freelook-style aim.
// One-shot presses (pause, throttle, flaps) are queued as bit flags.

export const ACTION_PAUSE = 1;
export const ACTION_THROTTLE_UP = 2;
export const ACTION_THROTTLE_DOWN = 4;
export const ACTION_FLAPS = 8;
export const ACTION_GEAR = 16;
export const ACTION_CAMERA = 32;
export const ACTION_RESTART = 64;

const KEYS = {
  rollLeft: new Set(['ArrowLeft', 'KeyA']),
  rollRight: new Set(['ArrowRight', 'KeyD']),
  pitchUp: new Set(['ArrowUp', 'KeyW']),
  pitchDown: new Set(['ArrowDown', 'KeyS']),
  yawLeft: new Set(['KeyQ']),
  yawRight: new Set(['KeyE']),
  throttleUp: new Set(['ShiftLeft', 'Equal']),
  throttleDown: new Set(['ControlLeft', 'Minus']),
  flaps: new Set(['KeyF']),
  gear: new Set(['KeyG']),
  camera: new Set(['KeyC', 'KeyV']),
  pause: new Set(['KeyP', 'Escape']),
  restart: new Set(['KeyR']),
};

export function createInput(canvas) {
  let roll = 0;
  let pitch = 0;
  let yaw = 0;
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseActive = false;
  let pointerLocked = false;

  function handleKeyDown(event) {
    const code = event.code;
    if (KEYS.rollLeft.has(code)) roll = -1;
    else if (KEYS.rollRight.has(code)) roll = 1;
    else if (KEYS.pitchUp.has(code)) pitch = -1;
    else if (KEYS.pitchDown.has(code)) pitch = 1;
    else if (KEYS.yawLeft.has(code)) yaw = -1;
    else if (KEYS.yawRight.has(code)) yaw = 1;
    else if (KEYS.throttleUp.has(code)) { if (!event.repeat) actions |= ACTION_THROTTLE_UP; }
    else if (KEYS.throttleDown.has(code)) { if (!event.repeat) actions |= ACTION_THROTTLE_DOWN; }
    else if (KEYS.flaps.has(code)) { if (!event.repeat) actions |= ACTION_FLAPS; }
    else if (KEYS.gear.has(code)) { if (!event.repeat) actions |= ACTION_GEAR; }
    else if (KEYS.camera.has(code)) { if (!event.repeat) actions |= ACTION_CAMERA; }
    else if (KEYS.pause.has(code)) { if (!event.repeat) actions |= ACTION_PAUSE; }
    else if (KEYS.restart.has(code)) { if (!event.repeat) actions |= ACTION_RESTART; }
    else return;
    event.preventDefault();
  }

  function handleKeyUp(event) {
    const code = event.code;
    if (KEYS.rollLeft.has(code) && roll === -1) roll = 0;
    else if (KEYS.rollRight.has(code) && roll === 1) roll = 0;
    else if (KEYS.pitchUp.has(code) && pitch === -1) pitch = 0;
    else if (KEYS.pitchDown.has(code) && pitch === 1) pitch = 0;
    else if (KEYS.yawLeft.has(code) && yaw === -1) yaw = 0;
    else if (KEYS.yawRight.has(code) && yaw === 1) yaw = 0;
  }

  function handleMouseMove(event) {
    if (!pointerLocked) return;
    mouseX += event.movementX;
    mouseY += event.movementY;
  }

  function handleMouseDown(event) {
    if (event.button === 0 && !pointerLocked) {
      canvas.requestPointerLock();
    }
  }

  function handlePointerLockChange() {
    pointerLocked = document.pointerLockElement === canvas;
    if (!pointerLocked) {
      mouseX = 0;
      mouseY = 0;
    }
  }

  function handleBlur() {
    roll = 0;
    pitch = 0;
    yaw = 0;
    mouseX = 0;
    mouseY = 0;
  }

  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  window.addEventListener('blur', handleBlur);
  canvas.addEventListener('mousedown', handleMouseDown);
  document.addEventListener('pointerlockchange', handlePointerLockChange);
  document.addEventListener('mousemove', handleMouseMove);

  return {
    /** Roll input: -1 left, 1 right, 0 none. */
    roll() { return roll; },
    /** Pitch input: -1 up, 1 down, 0 none. */
    pitch() { return pitch; },
    /** Yaw input: -1 left, 1 right, 0 none. */
    yaw() { return yaw; },
    /** Mouse delta since last frame (consumed). */
    takeMouse() {
      const dx = mouseX;
      const dy = mouseY;
      mouseX = 0;
      mouseY = 0;
      return { x: dx, y: dy };
    },
    /** One-shot actions since last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Whether pointer is locked (mouse steering active). */
    isPointerLocked() { return pointerLocked; },
    /** Clean up listeners. */
    destroy() {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      canvas.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('pointerlockchange', handlePointerLockChange);
      document.removeEventListener('mousemove', handleMouseMove);
    },
  };
}