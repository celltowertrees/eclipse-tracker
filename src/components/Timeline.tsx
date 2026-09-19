import { useEffect } from 'react'
import { tToUtcMs, utcMsToT } from '../astro/besselian'
import { utcTime } from '../lib/format'
import { useStore } from '../store'

const SPEEDS = [60, 300, 600, 1800]

export default function Timeline() {
  const selected = useStore((s) => s.selected)
  const range = useStore((s) => s.geometry?.penumbraRange ?? null)
  const umbra = useStore((s) => s.geometry?.umbraRange ?? null)
  const t = useStore((s) => s.t)
  const playing = useStore((s) => s.playing)
  const speed = useStore((s) => s.speed)
  const { setT, setPlaying, setSpeed } = useStore.getState()

  useEffect(() => {
    if (!playing || !range) return
    let last = performance.now()
    let raf = requestAnimationFrame(function tick(now) {
      const dtHours = ((now - last) / 1000) * (useStore.getState().speed / 3600)
      last = now
      let next = useStore.getState().t + dtHours
      if (next > range[1]) next = range[0]
      setT(next)
      raf = requestAnimationFrame(tick)
    })
    return () => cancelAnimationFrame(raf)
  }, [playing, range, setT])

  if (!selected || !range) return <div className="timeline timeline--loading">Computing path…</div>

  const e = selected.elements
  const tGreatest = utcMsToT(e, Date.parse(selected.greatest.utc))
  const pct = (x: number) => `${((x - range[0]) / (range[1] - range[0])) * 100}%`

  return (
    <div className="timeline">
      <button
        className="btn btn--icon"
        onClick={() => {
          if (!playing && t >= range[1] - 1e-3) setT(range[0])
          setPlaying(!playing)
        }}
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {playing ? '❚❚' : '▶'}
      </button>
      <div className="timeline__track">
        <div className="timeline__clock">
          <strong>{utcTime(tToUtcMs(e, t))}</strong> UTC
        </div>
        <div className="timeline__slider">
          {umbra && <div className="timeline__umbra" style={{ left: pct(umbra[0]), width: `calc(${pct(umbra[1])} - ${pct(umbra[0])})` }} />}
          <input
            type="range"
            min={range[0]}
            max={range[1]}
            step={1 / 3600}
            value={Math.min(range[1], Math.max(range[0], t))}
            onChange={(ev) => setT(Number(ev.target.value))}
            aria-label="Eclipse time"
          />
        </div>
        <div className="timeline__ends">
          <span>{utcTime(tToUtcMs(e, range[0]))}</span>
          <button className="linklike" onClick={() => setT(tGreatest)}>
            Greatest eclipse {utcTime(tToUtcMs(e, tGreatest))}
          </button>
          <span>{utcTime(tToUtcMs(e, range[1]))}</span>
        </div>
      </div>
      <select className="select select--small" value={speed} onChange={(ev) => setSpeed(Number(ev.target.value))} aria-label="Playback speed">
        {SPEEDS.map((s) => (
          <option key={s} value={s}>
            {s}×
          </option>
        ))}
      </select>
    </div>
  )
}
