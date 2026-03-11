// audio.js – Procedural audio system for voxel kart racing game
// Vanilla ES module. No dependencies, no build step.

export function createAudioManager() {
  let audioCtx = null;
  let masterGain = null;
  let musicGain = null;
  let sfxGain = null;
  let noiseBuffer = null;

  // Volume scalars (0–1)
  let masterVol = 1;
  let musicVol = 1;
  let sfxVol = 1;

  // Engine state
  let engineRunning = false;
  let engineOsc1 = null;
  let engineOsc2 = null;
  let engineLFO = null;
  let engineLFOGain = null;
  let engineGain = null;

  // Drift state
  let driftSource = null;
  let driftGain = null;

  // Music state
  let musicPlaying = false;
  let musicTrack = null;
  let musicSchedulerId = null;
  let musicNodes = [];        // nodes to disconnect on stop
  let musicNextBeatTime = 0;
  let musicBeatIndex = 0;
  let musicBeatDuration = 0;  // seconds per beat

  // ─── Helpers ──────────────────────────────────────────────

  function lerp(a, b, t) {
    return a + (b - a) * Math.min(1, Math.max(0, t));
  }

  function createNoiseBuffer() {
    const length = audioCtx.sampleRate; // 1 second
    const buffer = audioCtx.createBuffer(1, length, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  function noiseSrc() {
    const src = audioCtx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop = true;
    return src;
  }

  function cleanUp(node, time) {
    // Disconnect a node after it finishes (or at a given time).
    if (node.stop) {
      try { node.stop(time); } catch (_) { /* already stopped */ }
    }
    node.onended = () => {
      try { node.disconnect(); } catch (_) { /* ok */ }
    };
  }

  function scheduleClean(node, stopTime) {
    try { node.stop(stopTime); } catch (_) { /* ok */ }
    node.onended = () => {
      try { node.disconnect(); } catch (_) { /* ok */ }
    };
  }

  // ─── API ──────────────────────────────────────────────────

  function init() {
    if (audioCtx) return;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      console.warn('AudioContext not supported', e);
      return;
    }

    noiseBuffer = createNoiseBuffer();

    // Master → destination
    masterGain = audioCtx.createGain();
    masterGain.gain.value = masterVol;
    masterGain.connect(audioCtx.destination);

    // Music bus
    musicGain = audioCtx.createGain();
    musicGain.gain.value = musicVol;
    musicGain.connect(masterGain);

    // SFX bus
    sfxGain = audioCtx.createGain();
    sfxGain.gain.value = sfxVol;
    sfxGain.connect(masterGain);
  }

  // ─── Engine ───────────────────────────────────────────────

  function startEngine() {
    if (!audioCtx || engineRunning) return;
    engineRunning = true;

    const now = audioCtx.currentTime;

    // Gain for the whole engine group
    engineGain = audioCtx.createGain();
    engineGain.gain.value = 0.05;
    engineGain.connect(sfxGain);

    // LFO vibrato
    engineLFO = audioCtx.createOscillator();
    engineLFO.type = 'sine';
    engineLFO.frequency.value = 6;
    engineLFOGain = audioCtx.createGain();
    engineLFOGain.gain.value = 3; // vibrato depth in Hz
    engineLFO.connect(engineLFOGain);
    engineLFO.start(now);

    // Primary sawtooth
    engineOsc1 = audioCtx.createOscillator();
    engineOsc1.type = 'sawtooth';
    engineOsc1.frequency.value = 80;
    engineLFOGain.connect(engineOsc1.frequency);

    const osc1Gain = audioCtx.createGain();
    osc1Gain.gain.value = 1.0;
    engineOsc1.connect(osc1Gain);
    osc1Gain.connect(engineGain);
    engineOsc1.start(now);

    // Harmonic at 1.5× base, 30% vol
    engineOsc2 = audioCtx.createOscillator();
    engineOsc2.type = 'sawtooth';
    engineOsc2.frequency.value = 120;
    engineLFOGain.connect(engineOsc2.frequency);

    const osc2Gain = audioCtx.createGain();
    osc2Gain.gain.value = 0.3;
    engineOsc2.connect(osc2Gain);
    osc2Gain.connect(engineGain);
    engineOsc2.start(now);

    // Store sub-gains for disconnect later
    engineOsc1._subGain = osc1Gain;
    engineOsc2._subGain = osc2Gain;
  }

  function stopEngine() {
    if (!engineRunning) return;
    engineRunning = false;
    const now = audioCtx.currentTime;
    [engineOsc1, engineOsc2, engineLFO].forEach(o => {
      if (o) {
        try { o.stop(now); } catch (_) { /* ok */ }
        o.onended = () => {
          try { o.disconnect(); } catch (_) { /* ok */ }
          if (o._subGain) try { o._subGain.disconnect(); } catch (_) { /* ok */ }
        };
      }
    });
    if (engineLFOGain) try { engineLFOGain.disconnect(); } catch (_) { /* ok */ }
    if (engineGain) try { engineGain.disconnect(); } catch (_) { /* ok */ }
    engineOsc1 = engineOsc2 = engineLFO = engineLFOGain = engineGain = null;
  }

  function updateEngine(speed, maxSpeed, offRoad, boosting) {
    if (!engineRunning || !engineOsc1) return;

    const t = maxSpeed > 0 ? speed / maxSpeed : 0;
    let baseFreq = lerp(80, 220, t);

    if (offRoad) baseFreq *= 0.8;
    if (boosting) baseFreq += 50;

    const now = audioCtx.currentTime;
    engineOsc1.frequency.setTargetAtTime(baseFreq, now, 0.03);
    engineOsc2.frequency.setTargetAtTime(baseFreq * 1.5, now, 0.03);

    const vol = lerp(0.05, 0.15, t);
    engineGain.gain.setTargetAtTime(vol, now, 0.03);
  }

  // ─── Countdown ────────────────────────────────────────────

  function playCountdownBeep(isGo) {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const freq = isGo ? 880 : 440;
    const dur = isGo ? 0.4 : 0.2;
    const vol = isGo ? 0.5 : 0.3;

    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;

    const g = audioCtx.createGain();
    g.gain.setValueAtTime(vol, now);
    g.gain.linearRampToValueAtTime(0, now + dur);

    osc.connect(g);
    g.connect(sfxGain);
    osc.start(now);
    scheduleClean(osc, now + dur + 0.01);
  }

  // ─── Boost ────────────────────────────────────────────────

  function playBoost() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const dur = 0.3;

    const src = noiseSrc();
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 5;
    filter.frequency.setValueAtTime(500, now);
    filter.frequency.exponentialRampToValueAtTime(2000, now + dur);

    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.2, now);
    g.gain.linearRampToValueAtTime(0, now + dur);

    src.connect(filter);
    filter.connect(g);
    g.connect(sfxGain);
    src.start(now);
    scheduleClean(src, now + dur + 0.01);
  }

  // ─── Item Pickup ──────────────────────────────────────────

  function playItemPickup() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const notes = [800, 1000, 1200];
    const noteDur = 0.05;

    notes.forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const g = audioCtx.createGain();
      const start = now + i * noteDur;
      g.gain.setValueAtTime(0.15, start);
      g.gain.linearRampToValueAtTime(0, start + noteDur);

      osc.connect(g);
      g.connect(sfxGain);
      osc.start(start);
      scheduleClean(osc, start + noteDur + 0.01);
    });
  }

  // ─── Spark Bomb ───────────────────────────────────────────

  function playSparkBomb() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;

    // White noise burst
    const src = noiseSrc();
    const ng = audioCtx.createGain();
    ng.gain.setValueAtTime(0.2, now);
    ng.gain.linearRampToValueAtTime(0, now + 0.15);
    src.connect(ng);
    ng.connect(sfxGain);
    src.start(now);
    scheduleClean(src, now + 0.16);

    // Sine ping
    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 600;
    const og = audioCtx.createGain();
    og.gain.setValueAtTime(0.2, now);
    og.gain.linearRampToValueAtTime(0, now + 0.1);
    osc.connect(og);
    og.connect(sfxGain);
    osc.start(now);
    scheduleClean(osc, now + 0.11);
  }

  // ─── Slick Puddle ─────────────────────────────────────────

  function playSlickPuddle() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;

    const src = noiseSrc();
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300;

    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.15, now);
    g.gain.linearRampToValueAtTime(0, now + 0.15);

    src.connect(filter);
    filter.connect(g);
    g.connect(sfxGain);
    src.start(now);
    scheduleClean(src, now + 0.16);
  }

  // ─── Turbo Cell ───────────────────────────────────────────

  function playTurboCell() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const notes = [523, 659, 784]; // C5, E5, G5
    const noteDur = 0.08;

    notes.forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;

      const g = audioCtx.createGain();
      const start = now + i * noteDur;
      g.gain.setValueAtTime(0.2, start);
      g.gain.linearRampToValueAtTime(0, start + noteDur);

      osc.connect(g);
      g.connect(sfxGain);
      osc.start(start);
      scheduleClean(osc, start + noteDur + 0.01);
    });
  }

  // ─── Wall Hit ─────────────────────────────────────────────

  function playWallHit() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;

    const osc = audioCtx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 100;

    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.25, now);
    g.gain.linearRampToValueAtTime(0, now + 0.1);

    osc.connect(g);
    g.connect(sfxGain);
    osc.start(now);
    scheduleClean(osc, now + 0.11);
  }

  // ─── Drift ────────────────────────────────────────────────

  function playDriftStart() {
    if (!audioCtx) return;
    // Stop any previous drift sound
    stopDriftInternal();

    const now = audioCtx.currentTime;

    driftSource = noiseSrc();
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 3000;
    filter.Q.value = 1;

    driftGain = audioCtx.createGain();
    driftGain.gain.setValueAtTime(0.08, now);

    driftSource.connect(filter);
    filter.connect(driftGain);
    driftGain.connect(sfxGain);
    driftSource.start(now);

    // Store filter ref for cleanup
    driftSource._filter = filter;
  }

  function playDriftEnd() {
    if (!audioCtx || !driftSource || !driftGain) return;
    const now = audioCtx.currentTime;
    driftGain.gain.setTargetAtTime(0, now, 0.03); // ~0.1s fade
    const src = driftSource;
    const fil = driftSource._filter;
    const g = driftGain;
    setTimeout(() => {
      try { src.stop(); } catch (_) { /* ok */ }
      try { src.disconnect(); } catch (_) { /* ok */ }
      try { fil.disconnect(); } catch (_) { /* ok */ }
      try { g.disconnect(); } catch (_) { /* ok */ }
    }, 150);
    driftSource = null;
    driftGain = null;
  }

  function stopDriftInternal() {
    if (driftSource) {
      try { driftSource.stop(); } catch (_) { /* ok */ }
      try { driftSource.disconnect(); } catch (_) { /* ok */ }
      if (driftSource._filter) try { driftSource._filter.disconnect(); } catch (_) { /* ok */ }
    }
    if (driftGain) try { driftGain.disconnect(); } catch (_) { /* ok */ }
    driftSource = null;
    driftGain = null;
  }

  // ─── Music System ─────────────────────────────────────────

  const TRACKS = {
    'sunset-circuit': {
      bpm: 120,
      gain: 0.12,
      schedule: scheduleSunsetCircuit,
    },
    'crystal-caverns': {
      bpm: 100,
      gain: 0.10,
      schedule: scheduleCrystalCaverns,
    },
  };

  function startMusic(trackName) {
    if (!audioCtx) return;
    stopMusic();

    const track = TRACKS[trackName];
    if (!track) return;

    musicPlaying = true;
    musicTrack = track;
    musicBeatDuration = 60 / track.bpm;
    musicBeatIndex = 0;
    musicNextBeatTime = audioCtx.currentTime + 0.05;

    // Set music track gain
    musicGain.gain.setValueAtTime(track.gain, audioCtx.currentTime);

    musicSchedulerLoop();
  }

  function musicSchedulerLoop() {
    if (!musicPlaying) return;

    // Schedule notes that fall within the lookahead window
    const lookahead = 0.15; // seconds ahead to schedule
    while (musicNextBeatTime < audioCtx.currentTime + lookahead) {
      musicTrack.schedule(musicNextBeatTime, musicBeatIndex);
      musicBeatIndex++;
      // Advance by one 8th note (half a beat) for fine-grained scheduling
      musicNextBeatTime += musicBeatDuration / 2;
    }

    musicSchedulerId = requestAnimationFrame(musicSchedulerLoop);
  }

  function stopMusic() {
    musicPlaying = false;
    if (musicSchedulerId !== null) {
      cancelAnimationFrame(musicSchedulerId);
      musicSchedulerId = null;
    }
    // Stop and disconnect all scheduled music nodes
    musicNodes.forEach(n => {
      try { n.stop(); } catch (_) { /* ok */ }
      try { n.disconnect(); } catch (_) { /* ok */ }
    });
    musicNodes = [];
    musicTrack = null;
  }

  function musicOsc(type, freq, startTime, duration, vol) {
    const osc = audioCtx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;

    const g = audioCtx.createGain();
    g.gain.setValueAtTime(vol, startTime);
    g.gain.linearRampToValueAtTime(0, startTime + duration);

    osc.connect(g);
    g.connect(musicGain);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.02);
    osc.onended = () => {
      try { osc.disconnect(); } catch (_) { /* ok */ }
      try { g.disconnect(); } catch (_) { /* ok */ }
      const idx = musicNodes.indexOf(osc);
      if (idx !== -1) musicNodes.splice(idx, 1);
    };
    musicNodes.push(osc);
    return osc;
  }

  function musicNoise(filterType, filterFreq, filterQ, startTime, duration, vol) {
    const src = noiseSrc();
    const filter = audioCtx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = filterFreq;
    filter.Q.value = filterQ || 1;

    const g = audioCtx.createGain();
    g.gain.setValueAtTime(vol, startTime);
    g.gain.linearRampToValueAtTime(0, startTime + duration);

    src.connect(filter);
    filter.connect(g);
    g.connect(musicGain);
    src.start(startTime);
    src.stop(startTime + duration + 0.02);
    src.onended = () => {
      try { src.disconnect(); } catch (_) { /* ok */ }
      try { filter.disconnect(); } catch (_) { /* ok */ }
      try { g.disconnect(); } catch (_) { /* ok */ }
      const idx = musicNodes.indexOf(src);
      if (idx !== -1) musicNodes.splice(idx, 1);
    };
    musicNodes.push(src);
    return src;
  }

  // ─── Sunset Circuit ──────────────────────────────────────
  // C major, 120 BPM (beat = 0.5s, 8th = 0.25s)
  // schedulerBeatIndex counts in 8th notes

  function scheduleSunsetCircuit(time, eighthIndex) {
    const beat = musicBeatDuration;     // 0.5s (quarter note)
    const eighth = beat / 2;            // 0.25s

    // Bass: square wave, one note every 2 beats (= 4 quarter notes = 8 eighths)
    // Notes cycle: C3(131), G2(98), Am2(110), F2(87)
    const bassNotes = [131, 98, 110, 87];
    if (eighthIndex % 8 === 0) {
      const bassIdx = Math.floor(eighthIndex / 8) % bassNotes.length;
      musicOsc('square', bassNotes[bassIdx], time, beat * 2 * 0.9, 0.3);
    }

    // Melody: triangle pentatonic, every 8th note
    const melodyNotes = [523, 587, 659, 784, 880];
    const melodyIdx = eighthIndex % melodyNotes.length;
    musicOsc('triangle', melodyNotes[melodyIdx], time, eighth * 0.8, 0.2);

    // Hi-hat: filtered noise every 8th note (every scheduler tick)
    musicNoise('highpass', 8000, 2, time, 0.03, 0.15);
  }

  // ─── Crystal Caverns ─────────────────────────────────────
  // A minor, 100 BPM (beat = 0.6s, 8th = 0.3s)

  function scheduleCrystalCaverns(time, eighthIndex) {
    const beat = musicBeatDuration;     // 0.6s
    const eighth = beat / 2;            // 0.3s

    // Bass: sawtooth + lowpass, one note every 2 beats (= 4 eighths)
    const bassNotes = [110, 82, 87, 73];
    if (eighthIndex % 4 === 0) {
      const bassIdx = Math.floor(eighthIndex / 4) % bassNotes.length;
      const osc = audioCtx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = bassNotes[bassIdx];

      const filter = audioCtx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 200;

      const g = audioCtx.createGain();
      const dur = beat * 2 * 0.9;
      g.gain.setValueAtTime(0.3, time);
      g.gain.linearRampToValueAtTime(0, time + dur);

      osc.connect(filter);
      filter.connect(g);
      g.connect(musicGain);
      osc.start(time);
      osc.stop(time + dur + 0.02);
      osc.onended = () => {
        try { osc.disconnect(); } catch (_) { /* ok */ }
        try { filter.disconnect(); } catch (_) { /* ok */ }
        try { g.disconnect(); } catch (_) { /* ok */ }
        const idx = musicNodes.indexOf(osc);
        if (idx !== -1) musicNodes.splice(idx, 1);
      };
      musicNodes.push(osc);
    }

    // Melody: sine arpeggios [A4, C5, E5], every 2 eighths (= quarter note)
    const melodyNotes = [440, 523, 659];
    if (eighthIndex % 2 === 0) {
      const melodyIdx = Math.floor(eighthIndex / 2) % melodyNotes.length;
      musicOsc('sine', melodyNotes[melodyIdx], time, beat * 0.8, 0.2);
    }

    // Percussion: low sine 60Hz on beats 1 and 3 (eighths 0,4 within a 8-eighth bar)
    const barPos = eighthIndex % 8;
    if (barPos === 0 || barPos === 4) {
      musicOsc('sine', 60, time, 0.08, 0.25);
    }
  }

  // ─── Volume Controls ─────────────────────────────────────

  function setMasterVolume(v) {
    masterVol = Math.max(0, Math.min(1, v));
    if (masterGain) masterGain.gain.setValueAtTime(masterVol, audioCtx.currentTime);
  }

  function setMusicVolume(v) {
    musicVol = Math.max(0, Math.min(1, v));
    if (musicGain) {
      // Scale against the track's base gain
      const trackBase = musicTrack ? musicTrack.gain : 0.12;
      musicGain.gain.setValueAtTime(trackBase * musicVol, audioCtx.currentTime);
    }
  }

  function setSfxVolume(v) {
    sfxVol = Math.max(0, Math.min(1, v));
    if (sfxGain) sfxGain.gain.setValueAtTime(sfxVol, audioCtx.currentTime);
  }

  // ─── Suspend / Resume ────────────────────────────────────

  function suspend() {
    if (audioCtx && audioCtx.state === 'running') {
      audioCtx.suspend();
    }
  }

  function resume() {
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  // ─── Public Interface ────────────────────────────────────

  return {
    init,
    startEngine,
    stopEngine,
    updateEngine,
    playCountdownBeep,
    playBoost,
    playItemPickup,
    playSparkBomb,
    playSlickPuddle,
    playTurboCell,
    playWallHit,
    playDriftStart,
    playDriftEnd,
    startMusic,
    stopMusic,
    setMasterVolume,
    setMusicVolume,
    setSfxVolume,
    suspend,
    resume,
  };
}
