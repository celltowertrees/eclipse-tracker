import { useMemo } from 'react'
import { localCircumstances } from '../astro/local'
import { duration, localTime, timeZoneAt } from '../lib/format'
import { useStore } from '../store'

export default function CityList() {
  const selected = useStore((s) => s.selected)
  const pin = useStore((s) => s.pin)
  const { setPin, flyTo } = useStore.getState()

  const rows = useMemo(() => {
    if (!selected) return []
    return selected.cities
      .map((c) => ({ city: c, lc: localCircumstances(selected.elements, c.lat, c.lon), tz: timeZoneAt(c.lat, c.lon) }))
      .sort((a, b) => (a.lc.max?.t ?? 0) - (b.lc.max?.t ?? 0))
  }, [selected])

  if (!selected) return null
  if (!rows.length) return <p className="hint">No major cities see this eclipse — the path is almost entirely over ocean or polar regions.</p>

  return (
    <ul className="cities">
      {rows.map(({ city, lc, tz }) => {
        const central = lc.type === 'total' || lc.type === 'annular'
        const active = pin?.lat === city.lat && pin?.lon === city.lon
        return (
          <li key={`${city.name}-${city.lat}`}>
            <button
              className={`city${active ? ' city--active' : ''}`}
              onClick={() => {
                setPin({ lat: city.lat, lon: city.lon, label: `${city.name}, ${city.country}` })
                flyTo(city.lat, city.lon, 6)
              }}
            >
              <span className="city__name">
                {city.name}
                <span className="muted">{city.country}</span>
              </span>
              <span className="city__time">{lc.max ? localTime(lc.max.utcMs, tz) : '—'}</span>
              <span className={`city__dur city__dur--${lc.type}`}>
                {central ? duration(lc.centralDuration) : `${Math.round(lc.obscuration * 100)}% partial`}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
