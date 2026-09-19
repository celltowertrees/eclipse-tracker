// Besselian elements for a solar eclipse (Espenak & Meeus, Five Millennium Canon).
// Polynomials are in t = hours from t0 (Terrestrial Dynamical Time).

export interface BesselianElements {
  /** Calendar date of t0 (TDT) */
  year: number
  month: number
  day: number
  /** Reference time t0 in TDT hours */
  t0: number
  /** ΔT = TDT − UT in seconds */
  deltaT: number
  x: number[]
  y: number[]
  d: number[] // degrees
  mu: number[] // degrees
  l1: number[]
  l2: number[]
  tanf1: number
  tanf2: number
}

export interface ElementsAt {
  x: number
  y: number
  d: number // radians
  mu: number // radians
  l1: number
  l2: number
  dx: number // per hour
  dy: number
  dd: number // radians per hour
  dmu: number // radians per hour
}

const RAD = Math.PI / 180

function poly(c: number[], t: number): number {
  let v = 0
  for (let i = c.length - 1; i >= 0; i--) v = v * t + c[i]
  return v
}

function dpoly(c: number[], t: number): number {
  let v = 0
  for (let i = c.length - 1; i >= 1; i--) v = v * t + i * c[i]
  return v
}

export function elementsAt(e: BesselianElements, t: number): ElementsAt {
  return {
    x: poly(e.x, t),
    y: poly(e.y, t),
    d: poly(e.d, t) * RAD,
    mu: poly(e.mu, t) * RAD,
    l1: poly(e.l1, t),
    l2: poly(e.l2, t),
    dx: dpoly(e.x, t),
    dy: dpoly(e.y, t),
    dd: dpoly(e.d, t) * RAD,
    dmu: dpoly(e.mu, t) * RAD,
  }
}

/** Convert t (hours from t0, TDT) to a UTC epoch in milliseconds. */
export function tToUtcMs(e: BesselianElements, t: number): number {
  return Date.UTC(e.year, e.month - 1, e.day) + (e.t0 + t) * 3_600_000 - e.deltaT * 1000
}

export function utcMsToT(e: BesselianElements, ms: number): number {
  return (ms + e.deltaT * 1000 - Date.UTC(e.year, e.month - 1, e.day)) / 3_600_000 - e.t0
}
