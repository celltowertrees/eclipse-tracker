// Local circumstances of a solar eclipse for an observer, from Besselian elements
// (Explanatory Supplement ch. 8; Meeus, "Elements of Solar Eclipses").

import { elementsAt, tToUtcMs, type BesselianElements } from './besselian'
import { makeObserver, observerFundamental, type Observer } from './earth'

const RAD = Math.PI / 180
const DEG = 180 / Math.PI

export type LocalType = 'none' | 'partial' | 'annular' | 'total'

export interface Contact {
  t: number
  utcMs: number
  /** Sun altitude in degrees (geometric, no refraction) */
  alt: number
  az: number
}

export interface LocalCircumstances {
  type: LocalType
  magnitude: number
  obscuration: number
  /** Moon/Sun apparent diameter ratio */
  ratio: number
  max: Contact | null
  c1: Contact | null
  c2: Contact | null
  c3: Contact | null
  c4: Contact | null
  /** Duration of totality/annularity in seconds (0 if not central) */
  centralDuration: number
  /** Whether any part of the eclipse happens with the Sun above the horizon */
  visible: boolean
}

interface State {
  u: number
  v: number
  a: number
  b: number
  n2: number
  L1: number
  L2: number
  H: number
  d: number
}

function stateAt(e: BesselianElements, o: Observer, t: number): State {
  const E = elementsAt(e, t)
  const f = observerFundamental(E, o, e.deltaT)
  const u = E.x - f.xi
  const v = E.y - f.eta
  const a = E.dx - f.dxi
  const b = E.dy - f.deta
  return {
    u,
    v,
    a,
    b,
    n2: a * a + b * b,
    L1: E.l1 - f.zeta * e.tanf1,
    L2: E.l2 - f.zeta * e.tanf2,
    H: f.H,
    d: E.d,
  }
}

function sunAltAz(o: Observer, H: number, d: number): { alt: number; az: number } {
  const phi = o.lat * RAD
  const sinAlt = Math.sin(phi) * Math.sin(d) + Math.cos(phi) * Math.cos(d) * Math.cos(H)
  const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt))) * DEG
  const az = (Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(d) * Math.cos(phi)) * DEG + 180 + 360) % 360
  return { alt, az }
}

function makeContact(e: BesselianElements, o: Observer, t: number, s: State): Contact {
  return { t, utcMs: tToUtcMs(e, t), ...sunAltAz(o, s.H, s.d) }
}

/** Iterate to a contact where the observer is at distance |L| from the shadow axis. */
function solveContact(e: BesselianElements, o: Observer, tStart: number, which: 'L1' | 'L2', sign: -1 | 1): Contact | null {
  let t = tStart
  let s = stateAt(e, o, t)
  for (let i = 0; i < 30; i++) {
    const L = Math.abs(which === 'L1' ? s.L1 : s.L2)
    const n = Math.sqrt(s.n2)
    const S = (s.a * s.v - s.u * s.b) / (n * L)
    if (Math.abs(S) > 1) return null
    const tau = sign * (L / n) * Math.sqrt(1 - S * S) - (s.u * s.a + s.v * s.b) / s.n2
    t += tau
    s = stateAt(e, o, t)
    if (Math.abs(tau) < 1e-7) break
  }
  return makeContact(e, o, t, s)
}

/** Fraction of the Sun's disk area covered by the Moon. */
export function obscuration(ratio: number, dist: number): number {
  const r = ratio
  const c = dist
  if (c >= 1 + r) return 0
  if (c <= Math.abs(1 - r)) return r >= 1 ? 1 : r * r
  const a1 = r * r * Math.acos((c * c + r * r - 1) / (2 * c * r))
  const a2 = Math.acos((c * c + 1 - r * r) / (2 * c))
  const a3 = 0.5 * Math.sqrt((-c + r + 1) * (c + r - 1) * (c - r + 1) * (c + r + 1))
  return (a1 + a2 - a3) / Math.PI
}

export function localCircumstances(e: BesselianElements, lat: number, lon: number, heightM = 0): LocalCircumstances {
  const o = makeObserver(lat, lon, heightM)
  let t = 0
  let s = stateAt(e, o, t)
  for (let i = 0; i < 50; i++) {
    const tau = -(s.u * s.a + s.v * s.b) / s.n2
    t += tau
    s = stateAt(e, o, t)
    if (Math.abs(tau) < 1e-7) break
  }

  const m = Math.sqrt(s.u * s.u + s.v * s.v)
  const magnitude = (s.L1 - m) / (s.L1 + s.L2)
  const ratio = (s.L1 - s.L2) / (s.L1 + s.L2)
  const none: LocalCircumstances = {
    type: 'none',
    magnitude: 0,
    obscuration: 0,
    ratio,
    max: null,
    c1: null,
    c2: null,
    c3: null,
    c4: null,
    centralDuration: 0,
    visible: false,
  }
  if (m >= s.L1) return none

  const max = makeContact(e, o, t, s)
  const c1 = solveContact(e, o, t, 'L1', -1)
  const c4 = solveContact(e, o, t, 'L1', 1)
  let c2: Contact | null = null
  let c3: Contact | null = null
  let type: LocalType = 'partial'
  if (m < Math.abs(s.L2)) {
    type = s.L2 < 0 ? 'total' : 'annular'
    c2 = solveContact(e, o, t, 'L2', -1)
    c3 = solveContact(e, o, t, 'L2', 1)
  }
  const centralDuration = c2 && c3 ? (c3.t - c2.t) * 3600 : 0
  const visible = [c1, max, c4].some((c) => c && c.alt > 0)

  return {
    type,
    magnitude,
    obscuration: obscuration(ratio, (2 * m) / (s.L1 + s.L2)),
    ratio,
    max,
    c1,
    c2,
    c3,
    c4,
    centralDuration,
    visible,
  }
}
