// Central line and umbral/antumbral path limits (Explanatory Supplement ch. 8).

import { elementsAt, type BesselianElements, type ElementsAt } from './besselian'
import { ellipsoidFor, fundamentalToGeo, zetaAt, type Ellipsoid } from './earth'
import { unwrapLons, type LonLat } from './geo'

export interface CentralPoint {
  t: number
  lon: number
  lat: number
  /** 'T' where the umbra reaches the ground, 'A' where only the antumbra does */
  kind: 'T' | 'A'
}

export interface EclipsePath {
  central: CentralPoint[]
  north: LonLat[][]
  south: LonLat[][]
  /** Polygon rings (small quads) tiling the path of totality/annularity */
  polygons: LonLat[][]
}

/** Sample step: 20 seconds */
const DT = 1 / 180

/**
 * Point on a path limit at time t. The limit is where the observer's track relative
 * to the shadow is tangent to the umbra, i.e. perpendicular to the relative velocity.
 * side = +1 for the northern limit, −1 for the southern.
 */
function limitPoint(e: BesselianElements, E: ElementsAt, el: Ellipsoid, side: 1 | -1): LonLat | null {
  let xi = E.x
  let eta = E.y
  let zeta = zetaAt(el, xi, eta) ?? 0
  const sd = Math.sin(E.d)
  const cd = Math.cos(E.d)
  for (let i = 0; i < 8; i++) {
    const dxi = E.dmu * (zeta * cd - eta * sd)
    const deta = E.dmu * xi * sd - zeta * E.dd
    const a = E.dx - dxi
    const b = E.dy - deta
    const n = Math.hypot(a, b)
    const L = Math.abs(E.l2 - zeta * e.tanf2)
    xi = E.x - (side * L * b) / n
    eta = E.y + (side * L * a) / n
    const z = zetaAt(el, xi, eta)
    if (z === null) return null
    zeta = z
  }
  const g = fundamentalToGeo(E, el, xi, eta, e.deltaT)
  return g ? [g.lon, g.lat] : null
}

function runs<T>(items: (T | null)[]): T[][] {
  const out: T[][] = []
  let cur: T[] = []
  for (const it of items) {
    if (it) cur.push(it)
    else if (cur.length) {
      out.push(cur)
      cur = []
    }
  }
  if (cur.length) out.push(cur)
  return out
}

export function computePath(e: BesselianElements): EclipsePath {
  const central: (CentralPoint | null)[] = []
  const north: (LonLat | null)[] = []
  const south: (LonLat | null)[] = []
  const both: ({ n: LonLat; s: LonLat } | null)[] = []

  for (let t = -4; t <= 4; t += DT) {
    const E = elementsAt(e, t)
    const el = ellipsoidFor(E)
    const c = fundamentalToGeo(E, el, E.x, E.y, e.deltaT)
    central.push(c ? { t, lon: c.lon, lat: c.lat, kind: E.l2 - c.zeta * e.tanf2 < 0 ? 'T' : 'A' } : null)
    const n = limitPoint(e, E, el, 1)
    const s = limitPoint(e, E, el, -1)
    north.push(n)
    south.push(s)
    both.push(n && s ? { n, s } : null)
  }

  // Fill the band as small quads between consecutive limit samples. A single ring
  // (north limit + reversed south limit) breaks when the band passes over a pole.
  const polygons: LonLat[][] = []
  for (const run of runs(both)) {
    for (let i = 0; i + 1 < run.length; i++) {
      const quad = unwrapLons([run[i].n, run[i + 1].n, run[i + 1].s, run[i].s])
      const lons = quad.map((p) => p[0])
      // Quads straddling a pole are skipped; the globe doesn't render above ~85° anyway.
      if (Math.max(...lons) - Math.min(...lons) > 90) continue
      polygons.push([...quad, quad[0]])
    }
  }

  return {
    central: central.filter((c): c is CentralPoint => c !== null),
    north: runs(north).map(unwrapLons),
    south: runs(south).map(unwrapLons),
    polygons,
  }
}

/** Split the central line into unwrapped segments of constant kind (for hybrid eclipses). */
export function centralSegments(central: CentralPoint[]): { kind: 'T' | 'A'; coords: LonLat[] }[] {
  const segs: { kind: 'T' | 'A'; coords: LonLat[] }[] = []
  let prevT = -Infinity
  for (const p of central) {
    const last = segs[segs.length - 1]
    const gap = p.t - prevT > DT * 1.5
    if (!last || last.kind !== p.kind || gap) {
      const coords: LonLat[] = last && !gap ? [last.coords[last.coords.length - 1]] : []
      segs.push({ kind: p.kind, coords })
    }
    segs[segs.length - 1].coords.push([p.lon, p.lat])
    prevT = p.t
  }
  return segs.map((s) => ({ kind: s.kind, coords: unwrapLons(s.coords) }))
}

/** Northern (+1) or southern (−1) limit point at time t (hours from t0). */
export function limitAt(e: BesselianElements, t: number, side: 1 | -1): LonLat | null {
  const E = elementsAt(e, t)
  return limitPoint(e, E, ellipsoidFor(E), side)
}

/** Central-line point at time t (hours from t0). */
export function centralAt(e: BesselianElements, t: number): LonLat | null {
  const E = elementsAt(e, t)
  const c = fundamentalToGeo(E, ellipsoidFor(E), E.x, E.y, e.deltaT)
  return c ? [c.lon, c.lat] : null
}
