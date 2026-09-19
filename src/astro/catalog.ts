import type { BesselianElements } from './besselian'

export type EclipseKind = 'T' | 'A' | 'H'

export interface CityEntry {
  name: string
  country: string
  lat: number
  lon: number
  pop: number
}

export interface EclipseSummary {
  id: string // YYYY-MM-DD
  kind: EclipseKind
  /** Espenak's full type code, e.g. "T", "Am", "H3" */
  typeCode: string
  magnitude: number
  gamma: number
  saros: number
  greatest: {
    utc: string // ISO timestamp
    lat: number
    lon: number
    alt: number
    durationS: number
    pathWidthKm: number
  }
  elements: BesselianElements
  cities: CityEntry[]
}

export interface Catalog {
  acknowledgement: string
  eclipses: EclipseSummary[]
}

/** Raw record from the Five Millennium Canon "Extra" JSON. */
export interface CanonRecord {
  year: number
  month: number
  day: number
  eclipse_type: string
  magnitude: number
  instantOfGreatestEclipseUT: string
  greatestlongitude: number
  greatestlatitude: number
  greatestalt: number
  greatestpathwidth: number
  greatestduration: number
  gamma: number
  lunationnum: number
  deltat: number
  tanf1: number
  tanf2: number
  t0: string
  [key: string]: number | string
}

const pad = (n: number) => String(n).padStart(2, '0')

export function elementsFromCanon(r: CanonRecord): BesselianElements {
  const c = (p: string) => [1, 2, 3, 4].map((i) => Number(r[`${p}${i}`] ?? 0))
  return {
    year: r.year,
    month: r.month,
    day: r.day,
    t0: parseFloat(r.t0),
    deltaT: r.deltat,
    x: c('x'),
    y: c('y'),
    d: c('d'),
    mu: c('mu'),
    l1: c('l1'),
    l2: c('l2'),
    tanf1: r.tanf1,
    tanf2: r.tanf2,
  }
}

/** Saros number from the Meeus lunation number: consecutive lunations step the series by +38 (mod 223). */
export function sarosFromLunation(lunation: number): number {
  const s = (131 + 38 * (lunation - 335)) % 223
  return s <= 0 ? s + 223 : s
}

export function summaryFromCanon(r: CanonRecord): Omit<EclipseSummary, 'cities'> {
  const [hh, mm, ss] = r.instantOfGreatestEclipseUT.replace(' UT', '').trim().split(':').map(Number)
  const id = `${r.year}-${pad(r.month)}-${pad(r.day)}`
  return {
    id,
    kind: r.eclipse_type[0] as EclipseKind,
    typeCode: r.eclipse_type,
    magnitude: r.magnitude,
    gamma: r.gamma,
    saros: sarosFromLunation(r.lunationnum),
    greatest: {
      utc: new Date(Date.UTC(r.year, r.month - 1, r.day, hh, mm, ss)).toISOString(),
      lat: r.greatestlatitude,
      lon: r.greatestlongitude,
      alt: r.greatestalt,
      durationS: r.greatestduration,
      pathWidthKm: r.greatestpathwidth,
    },
    elements: elementsFromCanon(r),
  }
}
