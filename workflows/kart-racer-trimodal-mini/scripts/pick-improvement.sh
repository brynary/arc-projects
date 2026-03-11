#!/usr/bin/env bash
set -euo pipefail

mkdir -p .workflow

FOCUS=$(od -An -N1 -tu1 /dev/urandom | awk 'NF{print $1 % 10}')
echo "Focus: $FOCUS"

case $FOCUS in
0)
  NAME="Crash & Error Fixes"
  read -r -d '' BODY <<'AREA' || true
- Check browser console for ALL errors and warnings, fix every one
- Find and fix null/undefined reference errors and unhandled exceptions
- Fix race conditions: objects accessed before initialization, events firing out of order
- Fix resource cleanup: listeners not removed, intervals not cleared, objects not disposed
- Test both tracks and all 4 characters — every combination must load without errors
- Verify the full race lifecycle: menu → select → countdown → race → finish → results → menu
- Fix any state that leaks between races (old karts visible, stale timers, ghost objects)
AREA
  ;;
1)
  NAME="Camera System"
  read -r -d '' BODY <<'AREA' || true
- Camera must follow the player kart at a fixed, sensible offset behind and above
- Camera must not clip through track geometry, walls, or other objects
- Camera must rotate smoothly to follow kart heading — no snapping or jitter
- Camera must handle tight corners without losing sight of the kart
- Camera must transition cleanly between states: menu, countdown, racing, finish
- Fix camera behavior at race start: should be in position before countdown begins
- Camera should not behave differently across tracks — consistent feel everywhere
AREA
  ;;
2)
  NAME="Collision & Physics"
  read -r -d '' BODY <<'AREA' || true
- Karts must not pass through walls, barriers, or track boundaries under any conditions
- Karts must not fall through the track surface or get stuck inside geometry
- Wall collisions must deflect the kart cleanly — no sticking, no vibrating, no teleporting
- Kart-to-kart collisions must be stable: no overlapping, no launching into the air
- Items must collide reliably with their targets — no passing through karts
- Track boundary detection must work on both tracks with no gaps or escape routes
- Physics must be framerate-independent: same behavior at 30fps and 60fps
AREA
  ;;
3)
  NAME="Race Flow & State"
  read -r -d '' BODY <<'AREA' || true
- Race countdown must play correctly every time: 3, 2, 1, GO with proper timing
- Lap detection must be accurate: no false laps from reversing, no missed laps
- Position tracking must update correctly throughout the race
- Race must end reliably after 3 laps for all racers with correct final positions
- Results screen must show accurate times and positions matching what happened
- Restarting a race or returning to menu must fully reset all state
- Handle edge cases: what if player stops moving, reverses, or goes off-track
AREA
  ;;
4)
  NAME="Driving Feel"
  read -r -d '' BODY <<'AREA' || true
- Tune acceleration curves: snappy start, satisfying top speed buildup
- Improve steering response: tight at low speed, stable at high speed
- Refine drift entry: clear threshold, satisfying snap into drift angle
- Drift must not cause erratic behavior: no spinning out, no speed exploits
- Wall/boundary deflection must feel fair: bounce off cleanly, lose some speed, keep racing
- Boost must feel dramatic but controllable: speed increase without losing the kart
- All driving parameters must feel consistent across both tracks
AREA
  ;;
5)
  NAME="AI Reliability"
  read -r -d '' BODY <<'AREA' || true
- AI karts must complete all 3 laps on every track without getting stuck
- AI must not drive through walls, off track edges, or into dead ends
- AI must navigate every corner on every track — no recurring stuck points
- AI must maintain stable spacing: no clumping, no karts stopping randomly
- AI must cross the finish line and register proper race completion
- AI karts must be visible and rendered correctly throughout the entire race
- Fix any AI behavior that looks broken: spinning in circles, driving backward, oscillating
AREA
  ;;
6)
  NAME="Track Integrity"
  read -r -d '' BODY <<'AREA' || true
- Verify track geometry is watertight: no holes, gaps, or missing faces in the surface
- Track boundaries must form a complete enclosure — no escape routes anywhere
- Track width must be consistent and sufficient for multiple karts side by side
- Verify checkpoint/lap-line placement works correctly for all racing lines
- Fix any geometry that causes physics issues: bad normals, degenerate triangles, sharp edges
- Both tracks must be completable by both player and AI without encountering bugs
- Track hazards must be fair: clearly visible, avoidable, and consistent in behavior
AREA
  ;;
7)
  NAME="Item Systems"
  read -r -d '' BODY <<'AREA' || true
- Items must spawn, collect, activate, and despawn without errors
- Item effects must end reliably: no permanent speed changes, infinite shields, or stuck states
- Item visual indicators must appear and disappear in sync with the actual effect
- Tune distribution by position: better items for trailing racers, weaker for leaders
- Balance effect durations: impactful but not frustrating
- Test simultaneous item usage: multiple karts using items at the same time must not crash
- Audio feedback for item events: pickup, use, hit, and expiration sounds
AREA
  ;;
8)
  NAME="Performance & Stability"
  read -r -d '' BODY <<'AREA' || true
- Identify and fix frame drops: profile the render loop, optimize hot paths
- Reduce draw calls: merge static geometries, use instanced meshes for repeated objects
- Object pooling for particles and projectiles: reuse instead of create/destroy
- Fix memory leaks: objects not garbage collected, growing arrays, accumulating event listeners
- Game must maintain smooth framerate throughout the entire race — no hitches or stutters
- Test that performance doesn't degrade over time or across multiple races
- Ensure consistent frame pacing: no micro-stutters even when framerate is high
AREA
  ;;
9)
  NAME="Visual & Audio Polish"
  read -r -d '' BODY <<'AREA' || true
- Improve lighting: better directional light angles, ambient fill, shadow quality
- Enhance color palette: more vibrant track themes, better contrast between elements
- Add environmental props: trackside detail with voxel style consistency
- Engine sound must modulate smoothly with speed — no pops, clicks, or abrupt changes
- Add audio for key moments: countdown beeps, lap completion chime, race finish fanfare
- UI click sounds for menu navigation and button presses
- Ensure art style consistency: all assets share the same voxel aesthetic
AREA
  ;;
esac

cat > .workflow/improvement.md <<EOF
# Improvement Focus: ${FOCUS} — ${NAME}

${BODY}
EOF

echo "Wrote .workflow/improvement.md — Focus ${FOCUS}: ${NAME}"
