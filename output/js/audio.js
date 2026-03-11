// Procedural Web Audio API sound system for Fabro Racer
// All sounds generated with oscillators and noise — no external samples.

let ctx = null;
let masterGain = null;
let sfxBus = null;
let musicBus = null;
let initialized = false;

// Shared white noise buffer (2 seconds of mono noise at sample rate)
let noiseBuffer = null;

// Engine state
let engineOsc = null;
let engineLFO = null;
let engineLFOGain = null;
let engineGain = null;
let engineBaseFreq = 80;

// Music state
let musicTimers = [];
let musicNodes = [];
let musicPlaying = false;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createNoiseBuffer() {
  const length = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

function playNoise(dest, duration, filterType, filterFreq, gainVal) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(gainVal ?? 0.5, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);

  if (filterType && filterFreq) {
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = filterFreq;
    src.connect(filter);
    filter.connect(gain);
  } else {
    src.connect(gain);
  }

  gain.connect(dest);
  src.start(ctx.currentTime);
  src.stop(ctx.currentTime + duration);
}

function playTone(dest, type, freq, duration, startTime, gainVal) {
  const t = startTime ?? ctx.currentTime;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(gainVal ?? 0.3, t);
  gain.gain.linearRampToValueAtTime(0, t + duration);
  osc.connect(gain);
  gain.connect(dest);
  osc.start(t);
  osc.stop(t + duration);
}

// ---------------------------------------------------------------------------
// SFX definitions
// ---------------------------------------------------------------------------

const sfxPlay = {
  countdown() {
    // Sine 440 Hz, 0.15s
    playTone(sfxBus, 'sine', 440, 0.15);
  },

  countdownGo() {
    // Sine 880 Hz, 0.2s
    playTone(sfxBus, 'sine', 880, 0.2);
  },

  driftStart() {
    // White noise burst, bandpass 800 Hz, 0.2s
    playNoise(sfxBus, 0.2, 'bandpass', 800, 0.4);
  },

  driftTierUp() {
    // Sine sweep 800 → 1600 Hz, 0.15s
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(1600, ctx.currentTime + 0.15);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15);
    osc.connect(gain);
    gain.connect(sfxBus);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
  },

  boost() {
    // Noise + sine 100 Hz, 0.3s attack then fade
    const now = ctx.currentTime;

    // Noise component
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuffer;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(0.5, now + 0.3);
    noiseGain.gain.linearRampToValueAtTime(0, now + 0.6);
    noiseSrc.connect(noiseGain);
    noiseGain.connect(sfxBus);
    noiseSrc.start(now);
    noiseSrc.stop(now + 0.6);

    // Sine component
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 100;
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0, now);
    oscGain.gain.linearRampToValueAtTime(0.4, now + 0.3);
    oscGain.gain.linearRampToValueAtTime(0, now + 0.6);
    osc.connect(oscGain);
    oscGain.connect(sfxBus);
    osc.start(now);
    osc.stop(now + 0.6);
  },

  itemPickup() {
    // Ascending arpeggio: C5(523), E5(659), G5(784), 0.08s each
    const notes = [523, 659, 784];
    const dur = 0.08;
    for (let i = 0; i < notes.length; i++) {
      playTone(sfxBus, 'sine', notes[i], dur, ctx.currentTime + i * dur, 0.25);
    }
  },

  itemUse() {
    // Square wave 400 Hz, 0.1s + noise burst
    playTone(sfxBus, 'square', 400, 0.1, undefined, 0.2);
    playNoise(sfxBus, 0.1, null, null, 0.3);
  },

  wallHit() {
    // Noise burst, lowpass 200 Hz, 0.1s
    playNoise(sfxBus, 0.1, 'lowpass', 200, 0.5);
  },

  kartBump() {
    // Sine 600 Hz + 900 Hz, 0.08s
    playTone(sfxBus, 'sine', 600, 0.08, undefined, 0.25);
    playTone(sfxBus, 'sine', 900, 0.08, undefined, 0.25);
  },

  lapComplete() {
    // Ascending C-E-G-C: 523, 659, 784, 1047 Hz, 0.08s each
    const notes = [523, 659, 784, 1047];
    const dur = 0.08;
    for (let i = 0; i < notes.length; i++) {
      playTone(sfxBus, 'sine', notes[i], dur, ctx.currentTime + i * dur, 0.25);
    }
  },

  raceFinish() {
    // Chord: 523+659+784 Hz held 0.8s with fade
    const freqs = [523, 659, 784];
    for (const f of freqs) {
      playTone(sfxBus, 'sine', f, 0.8, undefined, 0.2);
    }
  },
};

// ---------------------------------------------------------------------------
// Music sequencer
// ---------------------------------------------------------------------------

const trackTempos = {
  sunset: 120,
  fungal: 130,
  neon: 140,
  frostbite: 150,
};

// Pentatonic scale degrees (C minor pentatonic): C D# F G A#
// Two octaves of notes in Hz for bass and lead
const bassNotes = [131, 156, 175, 196, 233]; // C3 D#3 F3 G3 A#3
const leadNotes = [523, 622, 698, 784, 932]; // C5 D#5 F5 G5 A#5

// Simple 4-bar pattern (16 steps)
const bassPattern  = [0, 0, 2, 2, 3, 3, 4, 2, 0, 0, 2, 2, 4, 3, 2, 0];
const leadPattern  = [4, 3, 2, -1, 3, 2, 0, -1, 2, 3, 4, -1, 3, 2, 0, -1]; // -1 = rest
const percPattern  = [1, 0, 0, 1, 1, 0, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0]; // 1 = hit

function startSequencer(bpm) {
  const stepDuration = (60 / bpm) / 4; // 16th notes
  let step = 0;
  const totalSteps = 16;

  function tick() {
    if (!musicPlaying) return;
    const now = ctx.currentTime;

    // Bass: sawtooth
    const bassIdx = bassPattern[step % totalSteps];
    const bassOsc = ctx.createOscillator();
    bassOsc.type = 'sawtooth';
    bassOsc.frequency.value = bassNotes[bassIdx];
    const bassGain = ctx.createGain();
    bassGain.gain.setValueAtTime(0.15, now);
    bassGain.gain.linearRampToValueAtTime(0, now + stepDuration * 0.9);
    bassOsc.connect(bassGain);
    bassGain.connect(musicBus);
    bassOsc.start(now);
    bassOsc.stop(now + stepDuration * 0.9);
    musicNodes.push(bassOsc);

    // Lead: square (skip rests)
    const leadIdx = leadPattern[step % totalSteps];
    if (leadIdx >= 0) {
      const leadOsc = ctx.createOscillator();
      leadOsc.type = 'square';
      leadOsc.frequency.value = leadNotes[leadIdx];
      const leadGain = ctx.createGain();
      leadGain.gain.setValueAtTime(0.08, now);
      leadGain.gain.linearRampToValueAtTime(0, now + stepDuration * 0.8);
      leadOsc.connect(leadGain);
      leadGain.connect(musicBus);
      leadOsc.start(now);
      leadOsc.stop(now + stepDuration * 0.8);
      musicNodes.push(leadOsc);
    }

    // Percussion: noise bursts
    if (percPattern[step % totalSteps]) {
      const noiseSrc = ctx.createBufferSource();
      noiseSrc.buffer = noiseBuffer;
      const hpf = ctx.createBiquadFilter();
      hpf.type = 'highpass';
      hpf.frequency.value = 5000;
      const percGain = ctx.createGain();
      percGain.gain.setValueAtTime(0.12, now);
      percGain.gain.linearRampToValueAtTime(0, now + 0.05);
      noiseSrc.connect(hpf);
      hpf.connect(percGain);
      percGain.connect(musicBus);
      noiseSrc.start(now);
      noiseSrc.stop(now + 0.05);
      musicNodes.push(noiseSrc);
    }

    step++;
    const timer = setTimeout(tick, stepDuration * 1000);
    musicTimers.push(timer);
  }

  tick();
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const AudioManager = {
  init() {
    if (initialized) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('AudioManager: could not create AudioContext', e);
      return;
    }

    masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);

    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.8;
    sfxBus.connect(masterGain);

    musicBus = ctx.createGain();
    musicBus.gain.value = 0.7;
    musicBus.connect(masterGain);

    noiseBuffer = createNoiseBuffer();
    initialized = true;
  },

  playSFX(name) {
    if (!initialized) return;
    const fn = sfxPlay[name];
    if (fn) fn();
  },

  startEngine() {
    if (!initialized) return;
    if (engineOsc) return; // already running

    const now = ctx.currentTime;

    // Main sawtooth oscillator
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineBaseFreq = 80;
    engineOsc.frequency.setValueAtTime(engineBaseFreq, now);

    // LFO for vibrato: ±5 Hz at 5 Hz rate
    engineLFO = ctx.createOscillator();
    engineLFO.type = 'sine';
    engineLFO.frequency.value = 5;

    engineLFOGain = ctx.createGain();
    engineLFOGain.gain.value = 5; // ±5 Hz

    engineLFO.connect(engineLFOGain);
    engineLFOGain.connect(engineOsc.frequency);

    // Engine volume gain
    engineGain = ctx.createGain();
    engineGain.gain.setValueAtTime(0.05, now);

    engineOsc.connect(engineGain);
    engineGain.connect(sfxBus);

    engineOsc.start(now);
    engineLFO.start(now);
  },

  setEngineSpeed(speed) {
    if (!initialized || !engineOsc) return;
    // Clamp speed 0-30
    const s = Math.max(0, Math.min(30, speed));
    const t = s / 30; // 0-1

    // Map to frequency 80-400 Hz
    engineBaseFreq = 80 + t * 320;
    engineOsc.frequency.setTargetAtTime(engineBaseFreq, ctx.currentTime, 0.05);

    // Gain follows speed: quiet idle (0.05) → louder at top speed (0.25)
    const vol = 0.05 + t * 0.2;
    engineGain.gain.setTargetAtTime(vol, ctx.currentTime, 0.05);
  },

  stopEngine() {
    if (!initialized) return;
    if (engineOsc) {
      engineOsc.stop();
      engineOsc.disconnect();
      engineOsc = null;
    }
    if (engineLFO) {
      engineLFO.stop();
      engineLFO.disconnect();
      engineLFO = null;
    }
    if (engineLFOGain) {
      engineLFOGain.disconnect();
      engineLFOGain = null;
    }
    if (engineGain) {
      engineGain.disconnect();
      engineGain = null;
    }
  },

  startMusic(trackId) {
    if (!initialized) return;
    this.stopMusic();
    musicPlaying = true;
    const bpm = trackTempos[trackId] || 130;
    startSequencer(bpm);
  },

  stopMusic() {
    if (!initialized) return;
    musicPlaying = false;
    for (const t of musicTimers) clearTimeout(t);
    musicTimers = [];
    for (const n of musicNodes) {
      try { n.stop(); } catch (_) { /* already stopped */ }
      try { n.disconnect(); } catch (_) { /* already disconnected */ }
    }
    musicNodes = [];
  },

  setMusicVolume(v) {
    if (!initialized) return;
    musicBus.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), ctx.currentTime, 0.02);
  },

  setSFXVolume(v) {
    if (!initialized) return;
    sfxBus.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), ctx.currentTime, 0.02);
  },
};
