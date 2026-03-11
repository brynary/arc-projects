// js/audio.js — Web Audio API: procedural SFX, per-track music loops, volume control

let ctx = null;
let masterGain = null;
let sfxGain = null;
let musicGain = null;
let noiseBuffer = null;

// Engine state (persistent oscillator)
let engineOsc = null;
let engineGainNode = null;
let engineFilter = null;
let engineRunning = false;

// Music state
let musicPlaying = false;
let musicTrack = null;
let musicTimerId = null;
let musicNodes = [];
let musicTempo = 1.0;

// Default volumes
let sfxVol = 0.8;
let musicVol = 0.6;

// ─── Setup ───────────────────────────────────────────────────────────────────

export function initAudio() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();

  masterGain = ctx.createGain();
  masterGain.gain.value = 1.0;
  masterGain.connect(ctx.destination);

  sfxGain = ctx.createGain();
  sfxGain.gain.value = sfxVol;
  sfxGain.connect(masterGain);

  musicGain = ctx.createGain();
  musicGain.gain.value = musicVol;
  musicGain.connect(masterGain);

  // Pre-generate 1s white noise buffer
  const sampleRate = ctx.sampleRate;
  noiseBuffer = ctx.createBuffer(1, sampleRate, sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < sampleRate; i++) {
    data[i] = Math.random() * 2 - 1;
  }
}

// ─── Utility helpers ─────────────────────────────────────────────────────────

function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }

function createNoiseSource(duration) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer;
  src.loop = false;
  return src;
}

function createOsc(type, freq) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = freq;
  return osc;
}

function createEnvelopedGain(startTime, peakVal, attackEnd, decayEnd) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, startTime);
  g.gain.linearRampToValueAtTime(peakVal, attackEnd);
  g.gain.linearRampToValueAtTime(0.0001, decayEnd);
  return g;
}

function playTone(type, freq, duration, volume = 0.3, startDelay = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + startDelay;
  const osc = createOsc(type, freq);
  const g = createEnvelopedGain(t, volume, t + 0.005, t + duration);
  osc.connect(g);
  g.connect(sfxGain);
  osc.start(t);
  osc.stop(t + duration);
}

function playNoiseBurst(duration, filterType, filterFreq, filterFreqEnd, volume = 0.3, startDelay = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + startDelay;
  const src = createNoiseSource(duration);
  const filter = ctx.createBiquadFilter();
  filter.type = filterType;
  filter.frequency.setValueAtTime(filterFreq, t);
  if (filterFreqEnd !== undefined && filterFreqEnd !== filterFreq) {
    filter.frequency.linearRampToValueAtTime(filterFreqEnd, t + duration);
  }
  filter.Q.value = 1.0;
  const g = createEnvelopedGain(t, volume, t + 0.005, t + duration);
  src.connect(filter);
  filter.connect(g);
  g.connect(sfxGain);
  src.start(t);
  src.stop(t + duration + 0.01);
}

// ─── Engine Sound ────────────────────────────────────────────────────────────

export function playEngine(speed, topSpeed, throttle) {
  if (!ctx) return;

  const speedRatio = clamp01(speed / topSpeed);
  // Base frequency modulates with speed; add a subtle second harmonic via frequency
  const freq = 80 + speedRatio * 120;
  // Filter cutoff rises with speed — engine sounds brighter at high RPM
  const filterFreq = 400 + speedRatio * 800;
  const gain = 0.12 * throttle;

  if (!engineRunning) {
    engineOsc = createOsc('sawtooth', freq);
    // Low-pass filter warms up the raw sawtooth — less harsh, more engine-like
    engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = filterFreq;
    engineFilter.Q.value = 2.0;
    engineGainNode = ctx.createGain();
    engineGainNode.gain.value = 0.001; // start near-silent to prevent click
    engineGainNode.gain.linearRampToValueAtTime(gain, ctx.currentTime + 0.05);
    engineOsc.connect(engineFilter);
    engineFilter.connect(engineGainNode);
    engineGainNode.connect(sfxGain);
    engineOsc.start(ctx.currentTime);
    engineRunning = true;
  } else {
    engineOsc.frequency.setTargetAtTime(freq, ctx.currentTime, 0.03);
    engineFilter.frequency.setTargetAtTime(filterFreq, ctx.currentTime, 0.03);
    engineGainNode.gain.setTargetAtTime(gain, ctx.currentTime, 0.03);
  }
}

export function stopEngine() {
  if (!ctx || !engineRunning) return;
  // Fade out over 50ms to prevent audible click from abrupt stop
  const fadeEnd = ctx.currentTime + 0.05;
  engineGainNode.gain.cancelScheduledValues(ctx.currentTime);
  engineGainNode.gain.setValueAtTime(engineGainNode.gain.value, ctx.currentTime);
  engineGainNode.gain.linearRampToValueAtTime(0.0001, fadeEnd);
  const osc = engineOsc;
  const gn = engineGainNode;
  const flt = engineFilter;
  engineOsc = null;
  engineGainNode = null;
  engineFilter = null;
  engineRunning = false;
  // Stop and disconnect after fade completes
  setTimeout(() => {
    try { osc.stop(); } catch (_) {}
    try { osc.disconnect(); } catch (_) {}
    try { flt.disconnect(); } catch (_) {}
    try { gn.disconnect(); } catch (_) {}
  }, 60);
}

// ─── Drift SFX ───────────────────────────────────────────────────────────────

export function playDriftStart() {
  if (!ctx) return;
  playNoiseBurst(0.15, 'bandpass', 2000, 2000, 0.25);
}

export function playDriftTierUp(tier) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const endFreqs = { 1: 800, 2: 1200, 3: 1600 };
  const endFreq = endFreqs[tier] || 800;
  const osc = createOsc('sine', 400);
  osc.frequency.setValueAtTime(400, t);
  osc.frequency.linearRampToValueAtTime(endFreq, t + 0.1);
  const g = createEnvelopedGain(t, 0.3, t + 0.005, t + 0.1);
  osc.connect(g);
  g.connect(sfxGain);
  osc.start(t);
  osc.stop(t + 0.1);
}

// ─── Boost SFX ───────────────────────────────────────────────────────────────

export function playBoostFire() {
  if (!ctx) return;
  playNoiseBurst(0.3, 'bandpass', 3000, 500, 0.35);
}

// ─── Item SFX ────────────────────────────────────────────────────────────────

export function playItemPickup() {
  if (!ctx) return;
  // C5=523.25, E5=659.25, G5=783.99
  playTone('sine', 523.25, 0.05, 0.25, 0);
  playTone('sine', 659.25, 0.05, 0.25, 0.05);
  playTone('sine', 783.99, 0.05, 0.25, 0.07);
}

export function playItemUse(itemType) {
  if (!ctx) return;
  const t = ctx.currentTime;

  switch (itemType) {
    case 'fizzBomb': {
      const osc = createOsc('sine', 800);
      osc.frequency.setValueAtTime(800, t);
      osc.frequency.linearRampToValueAtTime(200, t + 0.15);
      const g = createEnvelopedGain(t, 0.3, t + 0.005, t + 0.15);
      osc.connect(g);
      g.connect(sfxGain);
      osc.start(t);
      osc.stop(t + 0.15);
      break;
    }
    case 'oilSlick': {
      playNoiseBurst(0.1, 'lowpass', 800, 800, 0.25);
      break;
    }
    case 'shield': {
      playNoiseBurst(0.2, 'highpass', 4000, 4000, 0.2);
      break;
    }
    case 'turboPepper': {
      // Noise crackle: rapid gated noise bursts
      for (let i = 0; i < 6; i++) {
        playNoiseBurst(0.04, 'bandpass', 1500 + i * 300, 1500 + i * 300, 0.3, i * 0.05);
      }
      break;
    }
    case 'homingPigeon': {
      // Two alternating "coo" sines
      playTone('sine', 600, 0.08, 0.2, 0);
      playTone('sine', 500, 0.08, 0.2, 0.1);
      break;
    }
    case 'star': {
      // Arpeggiated high notes
      const notes = [1046.5, 1318.5, 1568, 1046.5, 1318.5, 1568];
      for (let i = 0; i < notes.length; i++) {
        playTone('sine', notes[i], 0.04, 0.2, i * 0.05);
      }
      break;
    }
    default:
      playTone('sine', 440, 0.1, 0.2);
      break;
  }
}

// ─── Collision SFX ───────────────────────────────────────────────────────────

export function playWallHit() {
  if (!ctx) return;
  playNoiseBurst(0.1, 'lowpass', 400, 400, 0.35);
}

export function playKartBump() {
  if (!ctx) return;
  playTone('sine', 300, 0.08, 0.25);
}

export function playItemHit() {
  if (!ctx) return;
  // Descending tone + noise = impact feel
  const t = ctx.currentTime;
  const osc = createOsc('square', 600);
  osc.frequency.setValueAtTime(600, t);
  osc.frequency.linearRampToValueAtTime(150, t + 0.25);
  const g = createEnvelopedGain(t, 0.25, t + 0.01, t + 0.25);
  osc.connect(g);
  g.connect(sfxGain);
  osc.start(t);
  osc.stop(t + 0.25);
  playNoiseBurst(0.12, 'lowpass', 600, 200, 0.2);
}

export function playShieldPop() {
  if (!ctx) return;
  // Quick bright pop: rising tone + noise burst
  playTone('sine', 1200, 0.08, 0.2);
  playNoiseBurst(0.1, 'highpass', 5000, 5000, 0.25);
}

// ─── Countdown SFX ──────────────────────────────────────────────────────────

export function playCountdownBeep() {
  if (!ctx) return;
  playTone('sine', 440, 0.15, 0.3);
}

export function playCountdownGo() {
  if (!ctx) return;
  playTone('sine', 880, 0.3, 0.35);
}

// ─── Race Progress SFX ──────────────────────────────────────────────────────

export function playLapComplete() {
  if (!ctx) return;
  // C4=261.63, E4=329.63, G4=392
  playTone('sine', 261.63, 0.1, 0.25, 0);
  playTone('sine', 329.63, 0.1, 0.25, 0.1);
  playTone('sine', 392.00, 0.15, 0.25, 0.2);
}

export function playFinalLap() {
  if (!ctx) return;
  // Five-note ascending scale C4-D4-E4-G4-C5
  const notes = [261.63, 293.66, 329.63, 392.00, 523.25];
  for (let i = 0; i < notes.length; i++) {
    playTone('sine', notes[i], 0.1, 0.3, i * 0.1);
  }
}

export function playRaceFinish() {
  if (!ctx) return;
  // Extended fanfare ~1s: C4-E4-G4-C5 (long) with harmony
  const melody = [
    { freq: 261.63, start: 0, dur: 0.12 },
    { freq: 329.63, start: 0.12, dur: 0.12 },
    { freq: 392.00, start: 0.24, dur: 0.12 },
    { freq: 523.25, start: 0.36, dur: 0.3 },
    { freq: 659.25, start: 0.66, dur: 0.34 },
  ];
  for (const n of melody) {
    playTone('square', n.freq, n.dur, 0.15, n.start);
    // Harmony a fifth above for richness
    playTone('triangle', n.freq * 1.5, n.dur, 0.1, n.start);
  }
}

// ─── Menu SFX ────────────────────────────────────────────────────────────────

export function playMenuNav() {
  if (!ctx) return;
  playNoiseBurst(0.02, 'highpass', 3000, 3000, 0.15);
}

export function playMenuConfirm() {
  if (!ctx) return;
  playTone('sine', 200, 0.05, 0.25);
}

// ─── Volume Control ──────────────────────────────────────────────────────────

export function setSFXVolume(v) {
  sfxVol = Math.max(0, Math.min(1, v / 100));
  if (sfxGain) sfxGain.gain.setTargetAtTime(sfxVol, ctx.currentTime, 0.02);
}

export function setMusicVolume(v) {
  musicVol = Math.max(0, Math.min(1, v / 100));
  if (musicGain) musicGain.gain.setTargetAtTime(musicVol, ctx.currentTime, 0.02);
}

// ─── Music System ────────────────────────────────────────────────────────────

// Note frequencies
const NOTE = {
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00, B5: 987.77,
  Bb3: 233.08, Eb4: 311.13, Ab3: 207.65, Bb4: 466.16, Eb5: 622.25,
  R: 0, // rest
};

// Track definitions: each has lead melody, bass line, wave types
const TRACKS = {
  'Sunset Bay': {
    bpm: 120,
    leadWave: 'square',
    bassWave: 'triangle',
    leadVol: 0.12,
    bassVol: 0.10,
    // 8 bars × 4 beats = 32 beat slots; each entry is [note, beats]
    lead: [
      [NOTE.C5, 1], [NOTE.E5, 1], [NOTE.G5, 1], [NOTE.E5, 1],
      [NOTE.C5, 1], [NOTE.G4, 1], [NOTE.E4, 2],
      [NOTE.D5, 1], [NOTE.E5, 1], [NOTE.G5, 1], [NOTE.C5, 1],
      [NOTE.E5, 2], [NOTE.C5, 2],
      [NOTE.G5, 1], [NOTE.E5, 1], [NOTE.C5, 1], [NOTE.G4, 1],
      [NOTE.C5, 1], [NOTE.E5, 1], [NOTE.G5, 2],
      [NOTE.E5, 1], [NOTE.D5, 1], [NOTE.C5, 2],
      [NOTE.R, 0.5], [NOTE.C5, 0.5], [NOTE.E5, 1], [NOTE.G5, 1],
    ],
    bass: [
      [NOTE.C3, 2], [NOTE.G3, 2],
      [NOTE.C3, 2], [NOTE.E3, 2],
      [NOTE.F3, 2], [NOTE.G3, 2],
      [NOTE.C3, 4],
      [NOTE.C3, 2], [NOTE.G3, 2],
      [NOTE.A3, 2], [NOTE.E3, 2],
      [NOTE.F3, 2], [NOTE.G3, 2],
      [NOTE.C3, 4],
    ],
  },
  'Mossy Canyon': {
    bpm: 100,
    leadWave: 'sine',
    bassWave: 'triangle',
    leadVol: 0.10,
    bassVol: 0.10,
    lead: [
      [NOTE.A4, 2], [NOTE.C5, 2],
      [NOTE.E5, 2], [NOTE.C5, 2],
      [NOTE.A4, 2], [NOTE.E4, 2],
      [NOTE.A4, 4],
      [NOTE.C5, 2], [NOTE.E5, 2],
      [NOTE.A4, 2], [NOTE.G4, 2],
      [NOTE.E4, 2], [NOTE.A4, 2],
      [NOTE.R, 2], [NOTE.A4, 2],
    ],
    bass: [
      [NOTE.A3, 4], [NOTE.C3, 4],
      [NOTE.E3, 4], [NOTE.A3, 4],
      [NOTE.A3, 4], [NOTE.G3, 4],
      [NOTE.E3, 4], [NOTE.A3, 4],
    ],
  },
  'Neon Grid': {
    bpm: 140,
    leadWave: 'sawtooth',
    bassWave: 'square',
    leadVol: 0.08,
    bassVol: 0.08,
    lead: [
      [NOTE.C5, 0.5], [NOTE.E5, 0.5], [NOTE.G5, 0.5], [NOTE.C5, 0.5],
      [NOTE.E5, 0.5], [NOTE.G5, 0.5], [NOTE.C5, 0.5], [NOTE.E5, 0.5],
      [NOTE.D5, 0.5], [NOTE.F5, 0.5], [NOTE.A5, 0.5], [NOTE.D5, 0.5],
      [NOTE.F5, 0.5], [NOTE.A5, 0.5], [NOTE.D5, 0.5], [NOTE.F5, 0.5],
      [NOTE.E5, 0.5], [NOTE.G5, 0.5], [NOTE.B5, 0.5], [NOTE.E5, 0.5],
      [NOTE.G5, 0.5], [NOTE.B5, 0.5], [NOTE.E5, 0.5], [NOTE.G5, 0.5],
      [NOTE.C5, 0.5], [NOTE.E5, 0.5], [NOTE.G5, 0.5], [NOTE.B4, 0.5],
      [NOTE.C5, 0.5], [NOTE.D5, 0.5], [NOTE.E5, 0.5], [NOTE.G5, 0.5],
      [NOTE.C5, 0.5], [NOTE.E5, 0.5], [NOTE.G5, 0.5], [NOTE.C5, 0.5],
      [NOTE.E5, 0.5], [NOTE.G5, 0.5], [NOTE.C5, 0.5], [NOTE.E5, 0.5],
      [NOTE.A4, 0.5], [NOTE.C5, 0.5], [NOTE.E5, 0.5], [NOTE.A4, 0.5],
      [NOTE.C5, 0.5], [NOTE.E5, 0.5], [NOTE.A4, 0.5], [NOTE.C5, 0.5],
      [NOTE.F4, 0.5], [NOTE.A4, 0.5], [NOTE.C5, 0.5], [NOTE.F4, 0.5],
      [NOTE.G4, 0.5], [NOTE.B4, 0.5], [NOTE.D5, 0.5], [NOTE.G4, 0.5],
      [NOTE.C5, 1], [NOTE.E5, 1], [NOTE.G5, 1], [NOTE.C5, 1],
    ],
    bass: [
      [NOTE.C3, 2], [NOTE.C3, 2],
      [NOTE.D3, 2], [NOTE.D3, 2],
      [NOTE.E3, 2], [NOTE.E3, 2],
      [NOTE.C3, 2], [NOTE.G3, 2],
      [NOTE.C3, 2], [NOTE.C3, 2],
      [NOTE.A3, 2], [NOTE.A3, 2],
      [NOTE.F3, 2], [NOTE.G3, 2],
      [NOTE.C3, 4],
    ],
  },
  'Volcano Peak': {
    bpm: 130,
    leadWave: 'sawtooth',
    bassWave: 'square',
    leadVol: 0.10,
    bassVol: 0.12,
    lead: [
      [NOTE.A4, 1], [NOTE.C5, 1], [NOTE.A4, 1], [NOTE.E4, 1],
      [NOTE.A4, 1], [NOTE.Bb4, 1], [NOTE.A4, 2],
      [NOTE.E5, 1], [NOTE.C5, 1], [NOTE.A4, 1], [NOTE.E4, 1],
      [NOTE.A4, 1], [NOTE.G4, 1], [NOTE.E4, 2],
      [NOTE.A4, 1], [NOTE.C5, 1], [NOTE.E5, 1], [NOTE.C5, 1],
      [NOTE.Bb4, 1], [NOTE.A4, 1], [NOTE.G4, 2],
      [NOTE.A4, 1], [NOTE.E5, 1], [NOTE.C5, 1], [NOTE.A4, 1],
      [NOTE.E4, 2], [NOTE.A4, 2],
    ],
    bass: [
      [NOTE.A3, 2], [NOTE.A3, 2],
      [NOTE.E3, 2], [NOTE.A3, 2],
      [NOTE.A3, 2], [NOTE.C3, 2],
      [NOTE.E3, 2], [NOTE.A3, 2],
      [NOTE.A3, 2], [NOTE.A3, 2],
      [NOTE.Bb3, 2], [NOTE.A3, 2],
      [NOTE.E3, 2], [NOTE.G3, 2],
      [NOTE.A3, 4],
    ],
  },
};

function scheduleLoop(trackName, startTime) {
  const track = TRACKS[trackName];
  if (!track || !musicPlaying) return;

  const beatDur = (60 / track.bpm) / musicTempo;

  // Schedule lead melody
  let leadTime = startTime;
  for (const [freq, beats] of track.lead) {
    const dur = beats * beatDur;
    if (freq > 0) {
      const osc = createOsc(track.leadWave, freq);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, leadTime);
      g.gain.linearRampToValueAtTime(track.leadVol, leadTime + 0.01);
      g.gain.setValueAtTime(track.leadVol, leadTime + dur - 0.02);
      g.gain.linearRampToValueAtTime(0.0001, leadTime + dur);
      osc.connect(g);
      g.connect(musicGain);
      osc.start(leadTime);
      osc.stop(leadTime + dur);
      musicNodes.push(osc);
    }
    leadTime += dur;
  }

  // Schedule bass line
  let bassTime = startTime;
  for (const [freq, beats] of track.bass) {
    const dur = beats * beatDur;
    if (freq > 0) {
      const osc = createOsc(track.bassWave, freq);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, bassTime);
      g.gain.linearRampToValueAtTime(track.bassVol, bassTime + 0.01);
      g.gain.setValueAtTime(track.bassVol, bassTime + dur - 0.02);
      g.gain.linearRampToValueAtTime(0.0001, bassTime + dur);
      osc.connect(g);
      g.connect(musicGain);
      osc.start(bassTime);
      osc.stop(bassTime + dur);
      musicNodes.push(osc);
    }
    bassTime += dur;
  }

  // Total loop duration: 8 bars × 4 beats
  const loopDuration = 32 * beatDur;
  const nextStart = startTime + loopDuration;
  const msUntilNext = (nextStart - ctx.currentTime - 0.1) * 1000;

  musicTimerId = setTimeout(() => {
    // Clean up old nodes
    musicNodes = musicNodes.filter(n => {
      try { n.disconnect(); } catch (_) {}
      return false;
    });
    if (musicPlaying) {
      scheduleLoop(trackName, nextStart);
    }
  }, Math.max(0, msUntilNext));
}

export function startMusic(trackName) {
  if (!ctx) return;
  stopMusic();

  // Normalize track name to find a match
  const key = Object.keys(TRACKS).find(
    k => k.toLowerCase().replace(/\s/g, '') === trackName.toLowerCase().replace(/\s/g, '')
  ) || Object.keys(TRACKS)[0];

  musicPlaying = true;
  musicTrack = key;
  musicTempo = 1.0;
  scheduleLoop(key, ctx.currentTime + 0.05);
}

export function stopMusic() {
  if (!ctx) return;
  musicPlaying = false;
  musicTrack = null;
  if (musicTimerId !== null) {
    clearTimeout(musicTimerId);
    musicTimerId = null;
  }
  for (const node of musicNodes) {
    try { node.stop(0); } catch (_) {}
    try { node.disconnect(); } catch (_) {}
  }
  musicNodes = [];
}

export function setMusicTempo(multiplier) {
  musicTempo = multiplier;
  // If music is currently playing, restart with new tempo
  if (musicPlaying && musicTrack) {
    const track = musicTrack;
    stopMusic();
    musicPlaying = true;
    musicTrack = track;
    musicTempo = multiplier;
    scheduleLoop(track, ctx.currentTime + 0.05);
  }
}