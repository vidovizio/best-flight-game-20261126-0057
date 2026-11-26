// Ember Ridge Airlift — audio system using Web Audio API.
// All sounds generated programmatically; no external files needed.

export function createAudio() {
  let context = null;
  let masterGain = null;
  let engineOsc = null;
  let engineGain = null;
  let windGain = null;
  let windNoise = null;
  let stallOsc = null;
  let stallGain = null;
  let enabled = false;
  let masterVolume = 0.5;

  function ensureContext() {
    if (context) return;
    context = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = context.createGain();
    masterGain.gain.value = masterVolume;
    masterGain.connect(context.destination);

    // Engine hum oscillator
    engineOsc = context.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 80;
    engineGain = context.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineGain);
    engineGain.connect(masterGain);
    engineOsc.start();

    // Wind noise
    const bufferSize = 4096;
    windNoise = context.createBufferSource();
    const noiseBuffer = context.createBuffer(1, bufferSize, context.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    windNoise.buffer = noiseBuffer;
    windNoise.loop = true;
    windGain = context.createGain();
    windGain.gain.value = 0;
    windNoise.connect(windGain);
    windGain.connect(masterGain);
    windNoise.start();

    // Stall warning
    stallOsc = context.createOscillator();
    stallOsc.type = 'square';
    stallOsc.frequency.value = 800;
    stallGain = context.createGain();
    stallGain.gain.value = 0;
    stallOsc.connect(stallGain);
    stallGain.connect(masterGain);
    stallOsc.start();

    enabled = true;
  }

  function resume() {
    if (context && context.state === 'suspended') {
      context.resume();
    }
  }

  function setMasterVolume(vol) {
    masterVolume = vol;
    if (masterGain) masterGain.gain.value = vol;
  }

  function updateEngine(airspeed, throttle, stalled, engineRunning) {
    if (!enabled || !engineRunning) {
      if (engineGain) engineGain.gain.value = 0;
      return;
    }
    resume();

    // Frequency based on throttle and airspeed
    const baseFreq = 80 + throttle * 140;
    const propFreq = 80 + airspeed * 0.5;
    engineOsc.frequency.value = baseFreq + propFreq * 0.3;

    // Volume based on throttle
    const targetGain = 0.15 + throttle * 0.25;
    engineGain.gain.value = targetGain * masterVolume;
  }

  function updateWind(airspeed) {
    if (!enabled) return;
    resume();

    // Wind volume increases with airspeed
    const targetGain = Math.min(0.3, airspeed * 0.002);
    windGain.gain.value = targetGain * masterVolume;
  }

  function updateStall(stalled) {
    if (!enabled) return;
    resume();

    if (stalled) {
      // Pulsing stall warning
      const time = context.currentTime;
      stallGain.gain.value = (Math.sin(time * 10) > 0 ? 0.3 : 0) * masterVolume;
    } else {
      stallGain.gain.value = 0;
    }
  }

  function playImpact(intensity) {
    if (!enabled) return;
    resume();

    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 120;
    gain.gain.value = intensity * 0.4 * masterVolume;
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.3);
    osc.stop(context.currentTime + 0.3);
  }

  function playGearSound() {
    if (!enabled) return;
    resume();

    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = 'sine';
    osc.frequency.value = 200;
    gain.gain.value = 0.15 * masterVolume;
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.2);
    osc.stop(context.currentTime + 0.2);
  }

  function playFlapSound() {
    if (!enabled) return;
    resume();

    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = 'sine';
    osc.frequency.value = 150;
    gain.gain.value = 0.12 * masterVolume;
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.25);
    osc.stop(context.currentTime + 0.25);
  }

  function playMissionComplete() {
    if (!enabled) return;
    resume();

    const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.value = 0.1 * masterVolume;
      osc.connect(gain);
      gain.connect(masterGain);
      const start = context.currentTime + i * 0.1;
      osc.start(start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
      osc.stop(start + 0.4);
    });
  }

  function playCrash() {
    if (!enabled) return;
    resume();

    // Explosion-like noise burst
    const bufferSize = 8192;
    const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / 1000);
    }
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = buffer;
    gain.gain.value = 0.5 * masterVolume;
    source.connect(gain);
    gain.connect(masterGain);
    source.start();
  }

  return {
    ensureContext,
    setMasterVolume,
    updateEngine,
    updateWind,
    updateStall,
    playImpact,
    playGearSound,
    playFlapSound,
    playMissionComplete,
    playCrash,
    get enabled() { return enabled; },
  };
}