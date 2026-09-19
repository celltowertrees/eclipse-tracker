import { useMemo } from 'react'
import { localCircumstances, type Contact } from '../astro/local'
import { distanceToPathKm } from '../lib/geometry'
import { duration, latLon, localTime, timeZoneAt, utcTime } from '../lib/format'
import { useStore } from '../store'

function Row({ label, c, tz }: { label: string; c: Contact | null; tz: string | null }) {
  if (!c) return null
  return (
    <tr className={c.alt < 0 ? 'below-horizon' : undefined}>
      <th>{label}</th>
      <td>{utcTime(c.utcMs)}</td>
      <td>{localTime(c.utcMs, tz)}</td>
      <td className="num">{c.alt.toFixed(0)}°</td>
    </tr>
  )
}

export default function LocationCard() {
  const pin = useStore((s) => s.pin)
  const selected = useStore((s) => s.selected)
  const geometry = useStore((s) => s.geometry)
  const { setPin, flyTo } = useStore.getState()

  const info = useMemo(() => {
    if (!pin || !selected) return null
    return {
      lc: localCircumstances(selected.elements, pin.lat, pin.lon),
      tz: timeZoneAt(pin.lat, pin.lon),
    }
  }, [pin, selected])

  if (!pin || !selected || !info) {
    return <p className="hint">Click anywhere on the globe to see local eclipse times for that spot.</p>
  }

  const { lc, tz } = info
  const central = lc.type === 'total' || lc.type === 'annular'
  const dist = !central && geometry ? distanceToPathKm(geometry, pin.lat, pin.lon) : null

  return (
    <section className="card card--pin">
      <header className="card__header">
        <div>
          <h3>{pin.label ?? 'Dropped pin'}</h3>
          <div className="muted">
            {latLon(pin.lat, pin.lon)}
            {tz && ` · ${tz}`}
          </div>
        </div>
        <div className="card__actions">
          <button className="btn btn--ghost" onClick={() => flyTo(pin.lat, pin.lon, 8)} aria-label="Zoom to location">
            Zoom
          </button>
          <button className="btn btn--ghost" onClick={() => setPin(null)} aria-label="Clear location">
            ✕
          </button>
        </div>
      </header>

      {lc.type === 'none' || !lc.visible ? (
        <p className="verdict verdict--none">No eclipse visible from here{lc.type !== 'none' ? ' (Sun below the horizon)' : ''}.</p>
      ) : (
        <>
          <p className={`verdict verdict--${lc.type}`}>
            {central ? (
              <>
                <strong>{lc.type === 'total' ? 'Total' : 'Annular'} eclipse</strong> for {duration(lc.centralDuration)}
              </>
            ) : (
              <>
                <strong>Partial eclipse</strong>, {(lc.obscuration * 100).toFixed(0)}% of the Sun covered
                {dist !== null && <span className="muted"> · {Math.round(dist).toLocaleString()} km from the path</span>}
              </>
            )}
          </p>
          <dl className="stats">
            <div>
              <dt>Magnitude</dt>
              <dd>{lc.magnitude.toFixed(3)}</dd>
            </div>
            <div>
              <dt>Obscuration</dt>
              <dd>{(lc.obscuration * 100).toFixed(1)}%</dd>
            </div>
            <div>
              <dt>Sun altitude</dt>
              <dd>{lc.max?.alt.toFixed(0)}°</dd>
            </div>
          </dl>
          <table className="contacts">
            <thead>
              <tr>
                <th />
                <th>UTC</th>
                <th>Local</th>
                <th className="num">Alt</th>
              </tr>
            </thead>
            <tbody>
              <Row label="Partial begins" c={lc.c1} tz={tz} />
              <Row label={lc.type === 'total' ? 'Totality begins' : 'Annularity begins'} c={lc.c2} tz={tz} />
              <Row label="Maximum" c={lc.max} tz={tz} />
              <Row label={lc.type === 'total' ? 'Totality ends' : 'Annularity ends'} c={lc.c3} tz={tz} />
              <Row label="Partial ends" c={lc.c4} tz={tz} />
            </tbody>
          </table>
          {[lc.c1, lc.max, lc.c4].some((c) => c && c.alt < 0) && (
            <p className="muted small">Greyed rows happen with the Sun below the horizon.</p>
          )}
        </>
      )}
    </section>
  )
}
