// Outline of the Moon's penumbral or umbral shadow on the Earth at a given instant.

import { elementsAt, type BesselianElements, type ElementsAt } from './besselian'
import { ellipsoidFor, fundamentalToGeo, scaledToGeo, zetaAt, type Ellipsoid } from './earth'
import { closeRing, unwrapLons, type LonLat } from './geo'

const TWO_PI = Math.PI * 2

export type ShadowKind = 'penumbra' | 'umbra'

interface Ctx {
  e: BesselianElements
  E: ElementsAt
  el: Ellipsoid
  L0: number
  tanf: number
}

function context(e: BesselianElements, t: number, kind: ShadowKind): Ctx {
  const E = elementsAt(e, t)
  return {
    e,
    E,
    el: ellipsoidFor(E),
    L0: kind === 'penumbra' ? E.l1 : E.l2,
    tanf: kind === 'penumbra' ? e.tanf1 : e.tanf2,
  }
}

/** Is the shadow-edge point at position angle Q (using the ζ=0 radius) on the Earth's disk? */
function edgeOnDisk(c: Ctx, Q: number): number {
  const L = Math.abs(c.L0)
  const xi = c.E.x + L * Math.sin(Q)
  const eta1 = (c.E.y + L * Math.cos(Q)) / c.el.rho1
  return 1 - xi * xi - eta1 * eta1
}

function edgeGeo(c: Ctx, Q: number): LonLat | null {
  let zeta = 0
  let geo = null
  for (let i = 0; i < 3; i++) {
    const L = Math.abs(c.L0 - zeta * c.tanf)
    const xi = c.E.x + L * Math.sin(Q)
    const eta = c.E.y + L * Math.cos(Q)
    const z = zetaAt(c.el, xi, eta)
    if (z === null) break
    zeta = z
    geo = fundamentalToGeo(c.E, c.el, xi, eta, c.e.deltaT)
  }
  return geo ? [geo.lon, geo.lat] : null
}

function limbGeo(c: Ctx, alpha: number): LonLat {
  const g = scaledToGeo(c.E, c.el, Math.sin(alpha), Math.cos(alpha), 0, c.e.deltaT)
  return [g.lon, g.lat]
}

function limbInsideShadow(c: Ctx, alpha: number): boolean {
  const dx = Math.sin(alpha) - c.E.x
  const dy = Math.cos(alpha) * c.el.rho1 - c.E.y
  return dx * dx + dy * dy < c.L0 * c.L0
}

/** Limb angle where the shadow edge crosses the Earth's limb between Q0 (on) and Q1 (off). */
function limbCrossing(c: Ctx, qOn: number, qOff: number): number {
  let a = qOn
  let b = qOff
  for (let i = 0; i < 20; i++) {
    const m = (a + b) / 2
    if (edgeOnDisk(c, m) >= 0) a = m
    else b = m
  }
  const L = Math.abs(c.L0)
  const xi = c.E.x + L * Math.sin(a)
  const eta1 = (c.E.y + L * Math.cos(a)) / c.el.rho1
  return Math.atan2(xi, eta1)
}

function limbArc(c: Ctx, from: number, to: number, stepRad: number): LonLat[] {
  // Choose the direction around the limb whose midpoint lies inside the shadow.
  let delta = (((to - from) % TWO_PI) + TWO_PI) % TWO_PI // counter-direction 0..2π
  if (!limbInsideShadow(c, from + delta / 2)) delta -= TWO_PI
  const n = Math.max(1, Math.ceil(Math.abs(delta) / stepRad))
  const pts: LonLat[] = []
  for (let i = 0; i <= n; i++) pts.push(limbGeo(c, from + (delta * i) / n))
  return pts
}

/**
 * Shadow outline as a closed lon/lat ring (longitudes unwrapped), clipped to the
 * sunlit hemisphere. Returns null if the shadow misses the Earth.
 */
export function shadowOutline(e: BesselianElements, t: number, kind: ShadowKind, steps = 144): LonLat[] | null {
  const c = context(e, t, kind)
  const dq = TWO_PI / steps
  const on: boolean[] = []
  for (let k = 0; k < steps; k++) on.push(edgeOnDisk(c, k * dq) >= 0)

  if (on.every(Boolean)) {
    const pts: LonLat[] = []
    for (let k = 0; k < steps; k++) {
      const p = edgeGeo(c, k * dq)
      if (p) pts.push(p)
    }
    return closeRing(pts)
  }
  if (!on.some(Boolean)) return null

  // Start just after an off→on transition so each on-run is contiguous.
  let start = 0
  while (!(on[start] && !on[(start - 1 + steps) % steps])) start++

  const pts: LonLat[] = []
  for (let i = 0; i < steps; i++) {
    const k = (start + i) % steps
    if (!on[k]) continue
    const p = edgeGeo(c, k * dq)
    if (p) pts.push(p)
    const kn = (k + 1) % steps
    if (!on[kn]) {
      // Exit through the limb; find where the edge comes back on.
      const exitA = limbCrossing(c, k * dq, k * dq + dq)
      let j = kn
      while (!on[j]) j = (j + 1) % steps
      const qOff = (j - 1) * dq
      const entryA = limbCrossing(c, j * dq, qOff)
      pts.push(...limbArc(c, exitA, entryA, (3 * Math.PI) / 180))
    }
  }
  return closeRing(pts)
}

/** Day/night terminator (where ζ = 0) at time t, as an unwrapped line. */
export function terminator(e: BesselianElements, t: number, steps = 180): LonLat[] {
  const E = elementsAt(e, t)
  const el = ellipsoidFor(E)
  const pts: LonLat[] = []
  for (let k = 0; k <= steps; k++) {
    const a = (k / steps) * TWO_PI
    const g = scaledToGeo(E, el, Math.sin(a), Math.cos(a), 0, e.deltaT)
    pts.push([g.lon, g.lat])
  }
  return unwrapLons(pts)
}

/** Sub-shadow point: where the shadow axis meets the Earth (null if it misses). */
export function shadowCenter(e: BesselianElements, t: number): LonLat | null {
  const E = elementsAt(e, t)
  const g = fundamentalToGeo(E, ellipsoidFor(E), E.x, E.y, e.deltaT)
  return g ? [g.lon, g.lat] : null
}

/** Time span (hours from t0) during which the given shadow touches the Earth. */
export function contactRange(e: BesselianElements, kind: ShadowKind): [number, number] | null {
  const touches = (t: number) => {
    const E = elementsAt(e, t)
    const el = ellipsoidFor(E)
    const L = Math.abs(kind === 'penumbra' ? E.l1 : E.l2)
    const r = Math.sqrt(E.x * E.x + (E.y / el.rho1) ** 2)
    return r < 1 + L
  }
  const dt = 1 / 60
  let first: number | null = null
  let last: number | null = null
  for (let t = -5; t <= 5; t += dt) {
    if (touches(t)) {
      if (first === null) first = t
      last = t
    }
  }
  if (first === null || last === null) return null
  const refine = (inside: number, outside: number) => {
    for (let i = 0; i < 30; i++) {
      const m = (inside + outside) / 2
      if (touches(m)) inside = m
      else outside = m
    }
    return inside
  }
  return [refine(first, first - dt), refine(last, last + dt)]
}
