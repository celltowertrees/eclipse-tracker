import tzlookup from 'tz-lookup'

export function timeZoneAt(lat: number, lon: number): string | null {
  try {
    return tzlookup(lat, lon)
  } catch {
    return null
  }
}

const fmtCache = new Map<string, Intl.DateTimeFormat>()
function fmt(key: string, make: () => Intl.DateTimeFormat) {
  let f = fmtCache.get(key)
  if (!f) {
    f = make()
    fmtCache.set(key, f)
  }
  return f
}

export function utcTime(ms: number): string {
  return new Date(ms).toISOString().slice(11, 19)
}

export function utcDateLong(ms: number): string {
  return fmt('utc-date', () =>
    new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }),
  ).format(ms)
}

/** Local wall-clock time, e.g. "12:05:08 GMT+2", with the day appended when it differs from the UTC day. */
export function localTime(ms: number, tz: string | null): string {
  if (!tz) return '—'
  const time = fmt(`t:${tz}`, () =>
    new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short' }),
  ).format(ms)
  const day = fmt(`d:${tz}`, () => new Intl.DateTimeFormat('en-GB', { timeZone: tz, day: 'numeric', month: 'short' }))
  const utcDay = fmt('d:UTC', () => new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: 'numeric', month: 'short' }))
  const d = day.format(ms)
  return d === utcDay.format(ms) ? time : `${time} (${d})`
}

export function duration(seconds: number): string {
  const s = Math.round(seconds)
  const m = Math.floor(s / 60)
  return `${m}m ${String(s % 60).padStart(2, '0')}s`
}

export function latLon(lat: number, lon: number): string {
  return `${Math.abs(lat).toFixed(2)}°${lat >= 0 ? 'N' : 'S'} ${Math.abs(lon).toFixed(2)}°${lon >= 0 ? 'E' : 'W'}`
}

export const KIND_LABEL = { T: 'Total', A: 'Annular', H: 'Hybrid' } as const
