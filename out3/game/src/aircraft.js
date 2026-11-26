// Ember Ridge Airlift — aircraft physics and instruments.
// Simplified but credible bush-plane flight model: lift, drag, thrust, weight.
// Control inputs affect roll, pitch, yaw rates. Instruments derive from state.

import { AIRCRAFT, FIELD, STEP } from './config.js';

export const INSTRUMENT_IDS = {
  ALTIMETER: 'alt',
  AIRSPEED: 'ias',
  HEADING: 'hdg',
  ATTITUDE: 'att',
  VERTICAL_SPEED: 'vs',
  THROTTLE: 'thr',
  FUEL: 'fuel',
  HEALTH: 'hp',
  TURN_COORDINATOR: 'tc',
};

export function createAircraft() {
  // State
  let x = 0;
  let y = 300;
  let z = 0;
  let vx = 0;
  let vy = 0;
  let vz = 0;
  let roll = 0;
  let pitch = 0;
  let yaw = 0;
  let rollRate = 0;
  let pitchRate = 0;
  let yawRate = 0;
  let throttle = 0.3;
  let flaps = 0; // 0 = up, 1 = down
  let gear = 0;  // 0 = up, 1 = down
  let fuel = AIRCRAFT.fuelCapacity;
  let health = AIRCRAFT.maxHealth;
  let engineRunning = true;
  let stalled = false;
  let onGround = false;
  let groundSpeed = 0;

  // Derived values (updated each step)
  let airspeed = 0;
  let verticalSpeed = 0;
  let heading = 0;
  let angleOfAttack = 0;
  let lift = 0;
  let drag = 0;
  let gLoad = 1;

  function reset(startX, startY, startZ, startHeading) {
    x = startX;
    y = startY;
    z = startZ;
    vx = 0;
    vy = 0;
    vz = 0;
    roll = 0;
    pitch = 0;
    yaw = startHeading;
    rollRate = 0;
    pitchRate = 0;
    yawRate = 0;
    throttle = 0.3;
    flaps = 0;
    gear = 1;
    fuel = AIRCRAFT.fuelCapacity;
    health = AIRCRAFT.maxHealth;
    engineRunning = true;
    stalled = false;
    onGround = true;
    groundSpeed = 0;
    updateDerived();
  }

  function updateDerived() {
    // Airspeed = magnitude of velocity vector
    airspeed = Math.sqrt(vx * vx + vy * vy + vz * vz);
    verticalSpeed = vy * 60; // m/s to ft/min (approximate)
    heading = yaw;
    if (heading < 0) heading += Math.PI * 2;
    if (heading >= Math.PI * 2) heading -= Math.PI * 2;
    groundSpeed = Math.sqrt(vx * vx + vz * vz) * 3.6; // m/s to km/h
  }

  function step(dt, inputRoll, inputPitch, inputYaw, actions) {
    if (!engineRunning) return;

    // Handle one-shot actions
    if (actions & 2) throttle = Math.min(1, throttle + 0.08); // THROTTLE_UP
    if (actions & 4) throttle = Math.max(0, throttle - 0.08); // THROTTLE_DOWN
    if (actions & 8) flaps = flaps === 0 ? 1 : 0; // FLAPS toggle
    if (actions & 16) gear = gear === 0 ? 1 : 0; // GEAR toggle

    // Fuel consumption
    const fuelBurn = AIRCRAFT.fuelBurnIdle + (AIRCRAFT.fuelBurnMax - AIRCRAFT.fuelBurnIdle) * throttle;
    fuel = Math.max(0, fuel - fuelBurn * dt);
    if (fuel <= 0) {
      engineRunning = false;
      throttle = 0;
    }

    // Control response
    const rollInput = inputRoll + (inputRoll === 0 ? 0 : 0); // keyboard roll
    const pitchInput = inputPitch;
    const yawInput = inputYaw;

    // Apply control rates
    rollRate += rollInput * AIRCRAFT.rollRate * dt;
    pitchRate += pitchInput * AIRCRAFT.pitchRate * dt;
    yawRate += yawInput * AIRCRAFT.yawRate * dt;

    // Damping
    rollRate *= AIRCRAFT.rollDamping;
    pitchRate *= AIRCRAFT.pitchDamping;
    yawRate *= 0.95;

    // Integrate attitude
    roll += rollRate * dt;
    pitch += pitchRate * dt;
    yaw += yawRate * dt;

    // Limit roll
    roll = Math.max(-Math.PI * 0.6, Math.min(Math.PI * 0.6, roll));

    // Thrust vector (along aircraft forward axis)
    const thrust = AIRCRAFT.idleThrust + (AIRCRAFT.maxThrust - AIRCRAFT.idleThrust) * throttle;
    const cosPitch = Math.cos(pitch);
    const sinPitch = Math.sin(pitch);
    const cosYaw = Math.cos(yaw);
    const sinYaw = Math.sin(yaw);
    const cosRoll = Math.cos(roll);
    const sinRoll = Math.sin(roll);

    // Forward direction in world space
    const fx = cosPitch * sinYaw;
    const fy = sinPitch;
    const fz = cosPitch * cosYaw;

    // Right direction
    const rx = cosRoll * cosYaw + sinRoll * sinPitch * sinYaw;
    const ry = -sinRoll * cosPitch;
    const rz = cosRoll * sinYaw - sinRoll * sinPitch * cosYaw;

    // Up direction
    const ux = sinRoll * sinYaw - cosRoll * sinPitch * cosYaw;
    const uy = cosRoll * cosPitch;
    const uz = sinRoll * cosYaw + cosRoll * sinPitch * sinYaw;

    // Forces
    // Thrust
    const thrustX = fx * thrust;
    const thrustY = fy * thrust;
    const thrustZ = fz * thrust;

    // Lift and drag (simplified)
    const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
    const dynamicPressure = 0.5 * 1.225 * speed * speed;
    const wingArea = AIRCRAFT.wingArea * (1 + flaps * 0.3);

    // Angle of attack approximation
    const velDotForward = (vx * fx + vy * fy + vz * fz) / (speed || 1);
    angleOfAttack = Math.asin(Math.max(-1, Math.min(1, -velDotForward)));
    if (angleOfAttack > AIRCRAFT.maxAoA) angleOfAttack = AIRCRAFT.maxAoA;

    // Stall check
    stalled = Math.abs(angleOfAttack) > AIRCRAFT.stallAoA && speed > 5;

    // Lift coefficient varies with AoA and flaps
    let cl = AIRCRAFT.liftCoeff * angleOfAttack * (1 + flaps * 0.5);
    if (stalled) cl *= 0.3;

    // Drag coefficient
    let cd = AIRCRAFT.dragCoeff * (1 + flaps * 0.8 + gear * 0.4);
    if (stalled) cd *= 2.5;

    lift = dynamicPressure * wingArea * cl;
    drag = dynamicPressure * wingArea * cd;

    // Lift acts perpendicular to velocity (mostly up in body frame)
    const liftX = ux * lift;
    const liftY = uy * lift;
    const liftZ = uz * lift;

    // Drag acts opposite to velocity
    const dragX = -vx * drag / (speed || 1);
    const dragY = -vy * drag / (speed || 1);
    const dragZ = -vz * drag / (speed || 1);

    // Weight
    const weight = AIRCRAFT.mass * 9.81;
    const weightX = 0;
    const weightY = -weight;
    const weightZ = 0;

    // Total force
    const totalX = thrustX + liftX + dragX + weightX;
    const totalY = thrustY + liftY + dragY + weightY;
    const totalZ = thrustZ + liftZ + dragZ + weightZ;

    // Acceleration
    const ax = totalX / AIRCRAFT.mass;
    const ay = totalY / AIRCRAFT.mass;
    const az = totalZ / AIRCRAFT.mass;

    // Integrate velocity
    vx += ax * dt;
    vy += ay * dt;
    vz += az * dt;

    // Speed limit
    const speedAfter = Math.sqrt(vx * vx + vy * vy + vz * vz);
    if (speedAfter > AIRCRAFT.maxSpeed) {
      const factor = AIRCRAFT.maxSpeed / speedAfter;
      vx *= factor;
      vy *= factor;
      vz *= factor;
    }

    // Integrate position
    x += vx * dt;
    y += vy * dt;
    z += vz * dt;

    // Ground collision
    onGround = false;
    if (y <= 0) {
      y = 0;
      const impactSpeed = Math.sqrt(vy * vy + vx * vx + vz * vz);
      if (impactSpeed > AIRCRAFT.hardLandingThreshold) {
        const damage = (impactSpeed - AIRCRAFT.hardLandingThreshold) * 8;
        health = Math.max(0, health - damage);
        if (impactSpeed > AIRCRAFT.crashThreshold) {
          health = 0;
        }
      }
      // On ground: stop vertical motion, add friction
      vy = 0;
      vx *= 0.95;
      vz *= 0.95;
      onGround = true;
      groundSpeed = Math.sqrt(vx * vx + vz * vz) * 3.6;
    }

    // Altitude limit
    if (y > AIRCRAFT.maxAltitude) {
      y = AIRCRAFT.maxAltitude;
      if (vy > 0) vy = 0;
    }

    updateDerived();

    // G-load approximation
    gLoad = Math.sqrt(ax * ax + ay * ay + az * az) / 9.81;

    return {
      stalled,
      onGround,
      engineRunning,
      health,
      fuel,
    };
  }

  function applyMouseInput(dx, dy, sensitivity) {
    rollRate -= dx * sensitivity;
    pitchRate -= dy * sensitivity;
  }

  function getState() {
    return {
      x, y, z,
      vx, vy, vz,
      roll, pitch, yaw,
      rollRate, pitchRate, yawRate,
      throttle, flaps, gear,
      fuel, health,
      engineRunning,
      stalled,
      onGround,
      airspeed,
      verticalSpeed,
      heading,
      angleOfAttack,
      lift,
      drag,
      gLoad,
      groundSpeed,
    };
  }

  function getInstruments() {
    return {
      [INSTRUMENT_IDS.ALTIMETER]: y,
      [INSTRUMENT_IDS.AIRSPEED]: airspeed * 3.6, // m/s to km/h
      [INSTRUMENT_IDS.HEADING]: heading * 180 / Math.PI,
      [INSTRUMENT_IDS.ATTITUDE]: { roll, pitch },
      [INSTRUMENT_IDS.VERTICAL_SPEED]: verticalSpeed,
      [INSTRUMENT_IDS.THROTTLE]: throttle,
      [INSTRUMENT_IDS.FUEL]: fuel,
      [INSTRUMENT_IDS.HEALTH]: health,
      [INSTRUMENT_IDS.TURN_COORDINATOR]: rollRate * 180 / Math.PI,
    };
  }

  function setThrottle(value) {
    throttle = Math.max(0, Math.min(1, value));
  }

  function setFlaps(value) {
    flaps = Math.max(0, Math.min(1, value));
  }

  function setGear(value) {
    gear = value ? 1 : 0;
  }

  return {
    reset,
    step,
    applyMouseInput,
    getState,
    getInstruments,
    setThrottle,
    setFlaps,
    setGear,
  };
}