import { useEffect, useMemo, useRef, useState } from "react"
import {
  GoldenGateFlightExperience,
  VIEW_PRESETS,
  type ViewPresetId,
} from "./golden-gate-flight"

export default function App() {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const experienceRef = useRef<GoldenGateFlightExperience | null>(null)
  const [activeView, setActiveView] = useState<ViewPresetId>("vista")

  useEffect(() => {
    if (!hostRef.current) return

    const experience = new GoldenGateFlightExperience(hostRef.current)
    experienceRef.current = experience
    setActiveView(experience.currentView)

    return () => {
      experience.dispose()
      experienceRef.current = null
    }
  }, [])

  const activePreset = useMemo(
    () => VIEW_PRESETS.find((preset) => preset.id === activeView) ?? VIEW_PRESETS[0],
    [activeView],
  )

  const handlePreset = (presetId: ViewPresetId) => {
    experienceRef.current?.setViewPreset(presetId)
    setActiveView(presetId)
  }

  const handleFullscreen = () => {
    experienceRef.current?.toggleFullscreen()
  }

  return (
    <main className="relative h-screen overflow-hidden bg-[#8bb0c8] text-white">
      <div ref={hostRef} className="absolute inset-0" />

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-col gap-3 p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="max-w-lg rounded-2xl border border-white/12 bg-slate-950/30 px-4 py-3 shadow-2xl backdrop-blur-md">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-orange-200/80">
              Golden Gate Flight Experience
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Fly the bridge at full scale
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-white/75 sm:text-[15px]">
              Explore a high-fidelity San Francisco bay scene with cinematic fog, moving traffic,
              structural close passes, and wide scenic flyovers.
            </p>
          </div>

          <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/12 bg-slate-950/30 px-3 py-2 shadow-xl backdrop-blur-md">
            <button
              type="button"
              data-action="fullscreen"
              onClick={handleFullscreen}
              className="rounded-full border border-white/12 px-3 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
            >
              Fullscreen
            </button>
          </div>
        </div>

        <div className="pointer-events-auto flex flex-wrap gap-2">
          {VIEW_PRESETS.map((preset) => {
            const isActive = preset.id === activeView
            return (
              <button
                key={preset.id}
                type="button"
                data-view={preset.id}
                onClick={() => handlePreset(preset.id)}
                className={`rounded-full border px-3.5 py-2 text-sm font-medium shadow-lg backdrop-blur-md transition ${
                  isActive
                    ? "border-orange-200/40 bg-orange-300/20 text-white"
                    : "border-white/12 bg-slate-950/30 text-white/78 hover:bg-white/10 hover:text-white"
                }`}
              >
                {preset.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-between gap-4 p-4 sm:p-6">
        <div className="max-w-md rounded-2xl border border-white/12 bg-slate-950/28 px-4 py-3 shadow-2xl backdrop-blur-md">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/60">
            Active viewpoint
          </p>
          <p className="mt-1 text-lg font-semibold text-white">{activePreset.label}</p>
          <p className="mt-1 text-sm leading-relaxed text-white/75">{activePreset.description}</p>
        </div>

        <div className="max-w-md rounded-2xl border border-white/12 bg-slate-950/28 px-4 py-3 text-right shadow-2xl backdrop-blur-md">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-white/60">
            Flight controls
          </p>
          <p className="mt-1 text-sm leading-relaxed text-white/80">
            Drag to look &bull; W/S or &uarr;/&darr; to move &bull; A/D to strafe &bull; &larr;/&rarr; to yaw &bull; Space/E to rise &bull;
            B/Q/Shift to drop &bull; 1-4 change views &bull; F toggles fullscreen
          </p>
        </div>
      </div>
    </main>
  )
}
