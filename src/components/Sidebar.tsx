import { duration, KIND_LABEL, latLon, utcDateLong, utcTime } from '../lib/format'
import { useStore } from '../store'
import CityList from './CityList'
import EclipseSelect from './EclipseSelect'
import LocationCard from './LocationCard'

function Overview() {
  const e = useStore((s) => s.selected)
  const loading = useStore((s) => s.loading)
  const flyTo = useStore((s) => s.flyTo)
  if (!e) return null
  const ms = Date.parse(e.greatest.utc)
  return (
    <section className="card">
      <header className="card__header">
        <div>
          <span className={`badge badge--${e.kind}`}>{KIND_LABEL[e.kind]} solar eclipse</span>
          <h2>{utcDateLong(ms)}</h2>
        </div>
      </header>
      <dl className="stats stats--grid">
        <div>
          <dt>Greatest eclipse</dt>
          <dd>{utcTime(ms)} UTC</dd>
        </div>
        <div>
          <dt>Max duration</dt>
          <dd>{duration(e.greatest.durationS)}</dd>
        </div>
        <div>
          <dt>Path width</dt>
          <dd>{Math.round(e.greatest.pathWidthKm)} km</dd>
        </div>
        <div>
          <dt>Magnitude</dt>
          <dd>{e.magnitude.toFixed(4)}</dd>
        </div>
        <div>
          <dt>Gamma</dt>
          <dd>{e.gamma.toFixed(4)}</dd>
        </div>
        <div>
          <dt>Saros</dt>
          <dd>{e.saros}</dd>
        </div>
      </dl>
      <button className="linklike" onClick={() => flyTo(e.greatest.lat, e.greatest.lon, 4)}>
        ◎ Greatest eclipse at {latLon(e.greatest.lat, e.greatest.lon)} · Sun {Math.round(e.greatest.alt)}° high
      </button>
      {loading && <p className="muted small">Computing path…</p>}
    </section>
  )
}

function Legend() {
  const e = useStore((s) => s.selected)
  const kind = e?.kind ?? 'T'
  return (
    <ul className="legend">
      <li>
        <span className={`swatch swatch--${kind}`} /> Path of {kind === 'A' ? 'annularity' : 'totality'}
      </li>
      <li>
        <span className="swatch swatch--zone" /> Partial eclipse visible
      </li>
      <li>
        <span className="swatch swatch--iso" /> Magnitude 0.2 – 0.8
      </li>
      <li>
        <span className="swatch swatch--shadow" /> Moon’s shadow (live)
      </li>
    </ul>
  )
}

export default function Sidebar() {
  return (
    <aside className="sidebar">
      <header className="brand">
        <svg viewBox="0 0 32 32" width="26" height="26" aria-hidden="true">
          <circle className="brand__sun" cx="16" cy="16" r="13" />
          <circle className="brand__moon" cx="19" cy="14" r="12" />
        </svg>
        <h1>Eclipse Tracker</h1>
      </header>
      <EclipseSelect />
      <Overview />
      <h3 className="section-title">Your location</h3>
      <LocationCard />
      <h3 className="section-title">Along the path</h3>
      <CityList />
      <Legend />
      <footer className="credits">
        Eclipse Predictions by Fred Espenak, NASA’s GSFC (Five Millennium Canon, Espenak &amp; Meeus). Map © OpenStreetMap contributors,
        OpenFreeMap, Natural Earth. Times are geometric predictions (±few s); lunar limb profile is not modelled.
      </footer>
    </aside>
  )
}
