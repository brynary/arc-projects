// Menu system — HTML/CSS overlay-based menus for Fabro Racer
// Title → Track Select → Character Select → Pre-Race → Race
import { CHARACTERS } from './characters.js';

const ALL_TRACKS = [
  { id: 'sunset_circuit',  module: './tracks/sunsetCircuit.js',  name: 'Sunset Circuit',  desc: 'Coastal resort — wide hairpins, S-curve through palms', difficulty: 1, theme: 'coastal', color: '#F4845F' },
  { id: 'fungal_canyon',   module: './tracks/fungalCanyon.js',   name: 'Fungal Canyon',   desc: 'Bioluminescent cave — figure-8 with bridge crossing',   difficulty: 2, theme: 'cave',    color: '#0DFFD6' },
  { id: 'neon_grid',       module: './tracks/neonGrid.js',       name: 'Neon Grid',        desc: 'Retro-future city — tight chicanes, banked curve',      difficulty: 3, theme: 'neon',    color: '#FF00FF' },
  { id: 'frostbite_pass',  module: './tracks/frostbitePass.js',  name: 'Frostbite Pass',   desc: 'Frozen mountain — switchbacks, ice cave, summit ridge', difficulty: 4, theme: 'snow',    color: '#80FFDB' },
];

// ── Show title screen ──────────────────────────────────────────────────
export function showTitleScreen(menuLayer, onStart) {
  menuLayer.innerHTML = `
    <div class="menu-panel" style="min-width:420px">
      <div class="menu-title" style="font-size:56px;margin-bottom:8px">🏎️ FABRO RACER</div>
      <p style="color:rgba(255,255,255,0.6);margin-bottom:28px;font-size:14px">Voxel kart racing — drift, boost, win!</p>
      <button class="menu-button" id="btn-race">🏁 RACE</button>
      <p style="color:rgba(255,255,255,0.3);margin-top:18px;font-size:11px">WASD / Arrows to drive · Space to drift · E to use item · ESC to pause</p>
    </div>`;
  menuLayer.style.display = 'flex';
  document.getElementById('btn-race').onclick = () => { menuLayer.style.display = 'none'; onStart(); };
}

// ── Track selection ────────────────────────────────────────────────────
export function showTrackSelect(menuLayer, onSelect, onBack) {
  let sel = 0;
  const render = () => {
    let cards = ALL_TRACKS.map((t, i) => {
      const active = i === sel ? 'border-color:' + t.color + ';transform:scale(1.05);box-shadow:0 0 20px ' + t.color + '40' : '';
      const stars = '★'.repeat(t.difficulty) + '☆'.repeat(4 - t.difficulty);
      return `<div class="track-card" data-idx="${i}" style="flex:1;padding:16px 12px;margin:0 6px;background:rgba(255,255,255,0.06);border:2px solid rgba(255,255,255,0.15);border-radius:12px;cursor:pointer;transition:all 0.15s;text-align:center;${active}">
        <div style="font-size:20px;font-weight:800;color:${t.color}">${t.name}</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.5);margin:6px 0">${t.desc}</div>
        <div style="font-size:16px;color:#facc15">${stars}</div>
      </div>`;
    }).join('');
    menuLayer.innerHTML = `
      <div class="menu-panel" style="max-width:700px;width:90%">
        <div class="menu-title" style="font-size:32px">Select Track</div>
        <div style="display:flex;margin-bottom:20px">${cards}</div>
        <div style="display:flex;gap:12px;justify-content:center">
          <button class="menu-button" id="btn-back-track" style="width:auto;padding:10px 28px">← Back</button>
          <button class="menu-button" id="btn-confirm-track" style="width:auto;padding:10px 28px;border-color:#facc15">Confirm →</button>
        </div>
        <p style="color:rgba(255,255,255,0.35);font-size:11px;margin-top:12px">← → to browse · Enter to confirm</p>
      </div>`;
    menuLayer.style.display = 'flex';
    document.querySelectorAll('.track-card').forEach(c => c.onclick = () => { sel = +c.dataset.idx; render(); });
    document.getElementById('btn-back-track').onclick = () => { menuLayer.style.display = 'none'; onBack(); };
    document.getElementById('btn-confirm-track').onclick = () => { menuLayer.style.display = 'none'; onSelect(ALL_TRACKS[sel]); };
  };
  render();
  // Keyboard nav
  const handler = e => {
    if (menuLayer.style.display === 'none') { window.removeEventListener('keydown', handler); return; }
    if (e.code === 'ArrowLeft') { sel = (sel - 1 + ALL_TRACKS.length) % ALL_TRACKS.length; render(); }
    if (e.code === 'ArrowRight') { sel = (sel + 1) % ALL_TRACKS.length; render(); }
    if (e.code === 'Enter') { document.getElementById('btn-confirm-track')?.click(); window.removeEventListener('keydown', handler); }
    if (e.code === 'Escape') { document.getElementById('btn-back-track')?.click(); window.removeEventListener('keydown', handler); }
  };
  window.addEventListener('keydown', handler);
}

// ── Character selection ────────────────────────────────────────────────
export function showCharSelect(menuLayer, onSelect, onBack) {
  let sel = 0;
  const render = () => {
    const grid = CHARACTERS.map((c, i) => {
      const border = i === sel ? `border-color:${c.colors.primary};box-shadow:0 0 12px ${c.colors.primary}60` : '';
      return `<div class="char-card" data-idx="${i}" style="padding:10px;background:rgba(255,255,255,0.06);border:2px solid rgba(255,255,255,0.12);border-radius:10px;cursor:pointer;text-align:center;transition:all .15s;${border}">
        <div style="width:40px;height:40px;margin:0 auto 6px;background:${c.colors.primary};border-radius:8px"></div>
        <div style="font-size:13px;font-weight:700">${c.name}</div>
      </div>`;
    }).join('');
    const c = CHARACTERS[sel];
    const statBar = (label, val) => `<div style="display:flex;align-items:center;margin:3px 0"><span style="width:60px;font-size:12px;color:rgba(255,255,255,0.6)">${label}</span><div style="flex:1;height:10px;background:rgba(255,255,255,0.1);border-radius:5px;overflow:hidden"><div style="width:${val*20}%;height:100%;background:${val>=4?'#4ade80':val>=3?'#facc15':'#f87171'};border-radius:5px"></div></div><span style="width:20px;text-align:right;font-size:12px;font-weight:700">${val}</span></div>`;
    menuLayer.innerHTML = `
      <div class="menu-panel" style="max-width:600px;width:90%">
        <div class="menu-title" style="font-size:32px">Select Character</div>
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px">${grid}</div>
        <div style="display:flex;gap:16px;align-items:flex-start;padding:12px;background:rgba(255,255,255,0.04);border-radius:10px;margin-bottom:16px">
          <div style="width:64px;height:64px;background:${c.colors.primary};border-radius:12px;flex-shrink:0"></div>
          <div style="flex:1">
            <div style="font-size:18px;font-weight:800;margin-bottom:4px">${c.name}</div>
            <div style="font-size:11px;color:rgba(255,255,255,0.5);margin-bottom:8px">${c.description || ''}</div>
            ${statBar('Speed', c.stats.speed)}${statBar('Accel', c.stats.acceleration)}${statBar('Handle', c.stats.handling)}${statBar('Weight', c.stats.weight)}
          </div>
        </div>
        <div style="display:flex;gap:12px;justify-content:center">
          <button class="menu-button" id="btn-back-char" style="width:auto;padding:10px 28px">← Back</button>
          <button class="menu-button" id="btn-confirm-char" style="width:auto;padding:10px 28px;border-color:#facc15">Confirm →</button>
        </div>
      </div>`;
    menuLayer.style.display = 'flex';
    document.querySelectorAll('.char-card').forEach(c => c.onclick = () => { sel = +c.dataset.idx; render(); });
    document.getElementById('btn-back-char').onclick = () => { menuLayer.style.display = 'none'; onBack(); };
    document.getElementById('btn-confirm-char').onclick = () => { menuLayer.style.display = 'none'; onSelect(CHARACTERS[sel]); };
  };
  render();
  const handler = e => {
    if (menuLayer.style.display === 'none') { window.removeEventListener('keydown', handler); return; }
    if (e.code === 'ArrowLeft') { sel = (sel - 1 + CHARACTERS.length) % CHARACTERS.length; render(); }
    if (e.code === 'ArrowRight') { sel = (sel + 1) % CHARACTERS.length; render(); }
    if (e.code === 'ArrowUp') { sel = (sel - 4 + CHARACTERS.length) % CHARACTERS.length; render(); }
    if (e.code === 'ArrowDown') { sel = (sel + 4) % CHARACTERS.length; render(); }
    if (e.code === 'Enter') { document.getElementById('btn-confirm-char')?.click(); window.removeEventListener('keydown', handler); }
    if (e.code === 'Escape') { document.getElementById('btn-back-char')?.click(); window.removeEventListener('keydown', handler); }
  };
  window.addEventListener('keydown', handler);
}

// ── Pre-race options ───────────────────────────────────────────────────
export function showPreRace(menuLayer, trackInfo, charInfo, shared, onStart, onBack) {
  const diffs = ['chill', 'standard', 'mean'];
  let diffIdx = diffs.indexOf(shared.difficulty);
  if (diffIdx < 0) diffIdx = 1;
  let mirror = shared.mirrorMode;
  const render = () => {
    menuLayer.innerHTML = `
      <div class="menu-panel" style="max-width:480px;width:90%">
        <div class="menu-title" style="font-size:28px">Race Setup</div>
        <div style="display:flex;gap:16px;margin-bottom:16px;padding:12px;background:rgba(255,255,255,0.04);border-radius:10px">
          <div>
            <div style="font-size:14px;color:rgba(255,255,255,0.5)">Track</div>
            <div style="font-size:16px;font-weight:700;color:${trackInfo.color}">${trackInfo.name}</div>
          </div>
          <div>
            <div style="font-size:14px;color:rgba(255,255,255,0.5)">Character</div>
            <div style="font-size:16px;font-weight:700;color:${charInfo.colors.primary}">${charInfo.name}</div>
          </div>
        </div>
        <div style="margin-bottom:16px;text-align:left">
          <div style="display:flex;align-items:center;margin:8px 0">
            <span style="width:100px;font-size:14px">Difficulty</span>
            <button class="menu-button" id="btn-diff" style="width:auto;margin:0;padding:6px 20px;font-size:14px">${diffs[diffIdx].toUpperCase()}</button>
          </div>
          <div style="display:flex;align-items:center;margin:8px 0">
            <span style="width:100px;font-size:14px">Mirror Mode</span>
            <button class="menu-button" id="btn-mirror" style="width:auto;margin:0;padding:6px 20px;font-size:14px">${mirror ? 'ON' : 'OFF'}</button>
          </div>
        </div>
        <div style="display:flex;gap:12px;justify-content:center">
          <button class="menu-button" id="btn-back-pre" style="width:auto;padding:10px 28px">← Back</button>
          <button class="menu-button" id="btn-start" style="width:auto;padding:12px 36px;font-size:20px;border-color:#22c55e;color:#22c55e">🏁 START RACE</button>
        </div>
      </div>`;
    menuLayer.style.display = 'flex';
    document.getElementById('btn-diff').onclick = () => { diffIdx = (diffIdx + 1) % diffs.length; render(); };
    document.getElementById('btn-mirror').onclick = () => { mirror = !mirror; render(); };
    document.getElementById('btn-back-pre').onclick = () => { menuLayer.style.display = 'none'; onBack(); };
    document.getElementById('btn-start').onclick = () => {
      shared.difficulty = diffs[diffIdx];
      shared.mirrorMode = mirror;
      menuLayer.style.display = 'none';
      onStart();
    };
  };
  render();
  const handler = e => {
    if (menuLayer.style.display === 'none') { window.removeEventListener('keydown', handler); return; }
    if (e.code === 'Enter') { document.getElementById('btn-start')?.click(); window.removeEventListener('keydown', handler); }
    if (e.code === 'Escape') { document.getElementById('btn-back-pre')?.click(); window.removeEventListener('keydown', handler); }
  };
  window.addEventListener('keydown', handler);
}

// ── Pause menu ─────────────────────────────────────────────────────────
export function showPauseMenu(menuLayer, onResume, onRestart, onQuit) {
  menuLayer.innerHTML = `
    <div class="menu-panel">
      <div class="menu-title" style="font-size:32px">⏸ Paused</div>
      <button class="menu-button" id="btn-resume">Resume</button>
      <button class="menu-button" id="btn-restart">Restart Race</button>
      <button class="menu-button" id="btn-quit">Quit to Menu</button>
    </div>`;
  menuLayer.style.display = 'flex';
  document.getElementById('btn-resume').onclick = () => { menuLayer.style.display = 'none'; onResume(); };
  document.getElementById('btn-restart').onclick = () => { menuLayer.style.display = 'none'; onRestart(); };
  document.getElementById('btn-quit').onclick = () => { menuLayer.style.display = 'none'; onQuit(); };
  const handler = e => {
    if (menuLayer.style.display === 'none') { window.removeEventListener('keydown', handler); return; }
    if (e.code === 'Escape') { document.getElementById('btn-resume')?.click(); window.removeEventListener('keydown', handler); }
  };
  window.addEventListener('keydown', handler);
}

// ── Results screen ─────────────────────────────────────────────────────
export function showResultsScreen(menuLayer, karts, onRestart, onNewRace, onQuit) {
  const sorted = [...karts].sort((a, b) => a.racePosition - b.racePosition);
  const fmt = s => { if (!s) return '—'; const m = Math.floor(s/60); const sec = s%60; return `${m}:${sec.toFixed(3).padStart(6,'0')}`; };
  const medals = ['🥇','🥈','🥉'];
  let rows = sorted.map((k,i) => {
    const isP = k.isPlayer;
    const style = isP ? 'color:#FFD700;font-weight:bold' : '';
    const medal = i < 3 ? medals[i] : `${i+1}.`;
    return `<tr style="${style}"><td style="padding:4px 10px">${medal}</td><td>${k.character.name}${isP?' ★':''}</td><td style="font-family:monospace">${fmt(k.finishTime)}</td></tr>`;
  }).join('');
  menuLayer.innerHTML = `
    <div class="menu-panel" style="max-width:500px">
      <div class="menu-title" style="font-size:36px">🏁 Race Complete!</div>
      <table style="width:100%;text-align:left;border-collapse:collapse;margin:12px 0">
        <tr style="border-bottom:1px solid rgba(255,255,255,0.2)"><th style="padding:4px 10px">#</th><th>Racer</th><th>Time</th></tr>
        ${rows}
      </table>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap">
        <button class="menu-button" id="btn-res-restart" style="width:auto;padding:10px 20px">🔄 Restart</button>
        <button class="menu-button" id="btn-res-new" style="width:auto;padding:10px 20px">🆕 New Race</button>
        <button class="menu-button" id="btn-res-quit" style="width:auto;padding:10px 20px">🏠 Menu</button>
      </div>
    </div>`;
  menuLayer.style.display = 'flex';
  document.getElementById('btn-res-restart').onclick = () => { menuLayer.style.display = 'none'; onRestart(); };
  document.getElementById('btn-res-new').onclick = () => { menuLayer.style.display = 'none'; onNewRace(); };
  document.getElementById('btn-res-quit').onclick = () => { menuLayer.style.display = 'none'; onQuit(); };
}

export { ALL_TRACKS };
