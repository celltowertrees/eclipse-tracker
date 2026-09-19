// Region where the eclipse is visible (partially), plus lines of equal magnitude,
// from a global grid of maximum visible magnitude contoured with d3-contour.

import { contours } from 'd3-contour'
import { elementsAt, type BesselianElements } from './besselian'
import { ephemerisLonCorrection, makeObserver } from './earth'
import type { LonLat } from './geo'
import { contactRange } from './shadow'

const RAD = Math.PI / 180

export interface PartialZone {
  /** Polygons (each an array of rings) where the eclipse is visible */
  zone: LonLat[][][]
  /** Boundary of the zone, without seams along the antimeridian */
  outline: LonLat[][]
  /** Magnitude isolines */
  isolines: { magnitude: number; lines: LonLat[][] }[]
}

export const ISOLINE_LEVELS = [0.2, 0.4, 0.6, 0.8]
const FLOOR = -0.3

export function computePartialZone(e: BesselianElements, stepDeg = 1, stepMin = 3): PartialZone {
  const range = contactRange(e, 'penumbra')
  if (!range) return { zone: [], outline: [], isolines: [] }

  // Precompute the elements at each time sample.
  const samples: { x: number; y: number; sd: number; cd: number; mu: number; l1: number; l2: number }[] = []
  for (let t = range[0]; t <= range[1]; t += stepMin / 60) {
    const E = elementsAt(e, t)
    samples.push({ x: E.x, y: E.y, sd: Math.sin(E.d), cd: Math.cos(E.d), mu: E.mu, l1: E.l1, l2: E.l2 })
  }

  const nx = Math.round(360 / stepDeg) + 1
  const ny = Math.round(180 / stepDeg) + 1
  const values = new Float64Array(nx * ny)
  const corr = ephemerisLonCorrection(e.deltaT) * RAD

  for (let j = 0; j < ny; j++) {
    const lat = -90 + j * stepDeg
    const o = makeObserver(lat, 0)
    for (let i = 0; i < nx; i++) {
      const lon = (-180 + i * stepDeg) * RAD
      let best = FLOOR
      for (const s of samples) {
        const H = s.mu + lon - corr
        const cH = Math.cos(H)
        const zeta = o.rhoSinPhi * s.sd + o.rhoCosPhi * cH * s.cd
        if (zeta <= 0) continue
        const xi = o.rhoCosPhi * Math.sin(H)
        const eta = o.rhoSinPhi * s.cd - o.rhoCosPhi * cH * s.sd
        const L1 = s.l1 - zeta * e.tanf1
        const L2 = s.l2 - zeta * e.tanf2
        const m = Math.hypot(s.x - xi, s.y - eta)
        const mag = (L1 - m) / (L1 + L2)
        if (mag > best) best = mag
      }
      values[j * nx + i] = best
    }
  }

  const gen = contours().size([nx, ny]).smooth(true)
  const toLonLat = ([px, py]: number[]): LonLat => [
    Math.max(-180, Math.min(180, -180 + (px - 0.5) * stepDeg)),
    Math.max(-90, Math.min(90, -90 + (py - 0.5) * stepDeg)),
  ]
  const onEdge = ([px, py]: number[]) => px <= 0.5 || px >= nx - 0.5 || py <= 0.5 || py >= ny - 0.5

  const zone = gen.thresholds([0])(Array.from(values))[0].coordinates.map((poly) => poly.map((ring) => ring.map(toLonLat)))

  const linesAt = (level: number): LonLat[][] => {
    const mp = gen.thresholds([level])(Array.from(values))[0]
    const lines: LonLat[][] = []
    for (const poly of mp.coordinates) {
      for (const ring of poly) {
        // Drop segments that run along the grid border (antimeridian / poles).
        let cur: LonLat[] = []
        for (let k = 0; k < ring.length; k++) {
          const p = ring[k]
          const prev = ring[k - 1]
          if (prev && onEdge(prev) && onEdge(p)) {
            if (cur.length > 1) lines.push(cur)
            cur = []
          }
          cur.push(toLonLat(p))
        }
        if (cur.length > 1) lines.push(cur)
      }
    }
    return lines
  }

  const outline = linesAt(0)
  const isolines = ISOLINE_LEVELS.map((magnitude) => ({ magnitude, lines: linesAt(magnitude) }))

  return { zone, outline, isolines }
}
