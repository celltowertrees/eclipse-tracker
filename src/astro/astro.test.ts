import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { utcMsToT } from './besselian'
import type { Catalog } from './catalog'
import { haversineKm } from './earth'
import { localCircumstances } from './local'
import { centralAt, centralSegments, computePath, limitAt } from './path'
import { computePartialZone } from './partialZone'
import { contactRange, shadowOutline } from './shadow'

const catalog = JSON.parse(readFileSync(new URL('../../public/data/catalog.json', import.meta.url), 'utf8')) as Catalog
const get = (id: string) => {
  const e = catalog.eclipses.find((x) => x.id === id)
  if (!e) throw new Error(`missing ${id}`)
  return e
}
const dm = (deg: number, min: number, sign = 1) => sign * (deg + min / 60)

describe('catalog', () => {
  it('contains only central eclipses in 1900–2100', () => {
    expect(catalog.eclipses.length).toBeGreaterThan(290)
    expect(catalog.eclipses.every((e) => 'TAH'.includes(e.kind))).toBe(true)
  })

  it('derives Saros numbers', () => {
    expect(get('2017-08-21').saros).toBe(145)
    expect(get('2024-04-08').saros).toBe(139)
    expect(get('2027-02-06').saros).toBe(131)
    expect(get('2027-08-02').saros).toBe(136)
  })
})

describe('local circumstances vs NASA', () => {
  it('2027 Feb 6 greatest eclipse: annular, 7m51s', () => {
    const e = get('2027-02-06')
    const lc = localCircumstances(e.elements, e.greatest.lat, e.greatest.lon)
    expect(lc.type).toBe('annular')
    expect(lc.centralDuration).toBeCloseTo(471, -1)
    expect(Math.abs(lc.max!.alt - 72.7)).toBeLessThan(0.5)
  })

  it('2027 Aug 2 Luxor: total, ~6m20s', () => {
    const lc = localCircumstances(get('2027-08-02').elements, 25.687, 32.639)
    expect(lc.type).toBe('total')
    expect(Math.abs(lc.centralDuration - 380)).toBeLessThan(5)
  })

  it('2024 Apr 8 Dallas: total 3m51.6s, C2 18:40:40 UT', () => {
    const lc = localCircumstances(get('2024-04-08').elements, 32.7767, -96.797)
    expect(lc.type).toBe('total')
    expect(Math.abs(lc.centralDuration - 231.6)).toBeLessThan(4)
    expect(Math.abs(lc.c2!.utcMs - Date.UTC(2024, 3, 8, 18, 40, 40)) / 1000).toBeLessThan(5)
  })

  it('partial-only location outside the path', () => {
    const lc = localCircumstances(get('2024-04-08').elements, 40.7128, -74.006) // New York
    expect(lc.type).toBe('partial')
    expect(lc.magnitude).toBeGreaterThan(0.85)
    expect(lc.magnitude).toBeLessThan(1)
    expect(lc.obscuration).toBeGreaterThan(0.85)
  })
})

describe('path geometry vs NASA path table (2024 Apr 8, ΔT = 70.6 s)', () => {
  const e = { ...get('2024-04-08').elements, deltaT: 70.6 }
  const rows: [number, number, [number, number], [number, number], [number, number]][] = [
    [18, 0, [dm(20, 53.8), dm(109, 30.6, -1)], [dm(19, 44.6), dm(108, 1.5, -1)], [dm(20, 19.2), dm(108, 45.8, -1)]],
    [18, 30, [dm(29, 32.2), dm(101, 11.9, -1)], [dm(28, 15.1), dm(99, 49.8, -1)], [dm(28, 53.6), dm(100, 30.7, -1)]],
    [19, 30, [dm(46, 11.6), dm(71, 24.2, -1)], [dm(44, 33.8), dm(71, 13.8, -1)], [dm(45, 22.4), dm(71, 19.7, -1)]],
  ]
  for (const [h, m, n, s, c] of rows) {
    it(`limits and central line at ${h}:${String(m).padStart(2, '0')} UT within 1.5 km`, () => {
      const t = utcMsToT(e, Date.UTC(2024, 3, 8, h, m))
      const N = limitAt(e, t, 1)!
      const S = limitAt(e, t, -1)!
      const C = centralAt(e, t)!
      expect(haversineKm(N[1], N[0], n[0], n[1])).toBeLessThan(1.5)
      expect(haversineKm(S[1], S[0], s[0], s[1])).toBeLessThan(1.5)
      expect(haversineKm(C[1], C[0], c[0], c[1])).toBeLessThan(1.5)
    })
  }
})

describe('path assembly', () => {
  it('tiles the 2027 Aug 2 path with one continuous run of quads', () => {
    const p = computePath(get('2027-08-02').elements)
    expect(p.polygons.length).toBeGreaterThan(100)
    expect(p.north.length).toBe(1)
    expect(p.south.length).toBe(1)
    expect(p.central.every((c) => c.kind === 'T')).toBe(true)
  })

  it('splits the 2023 Apr 20 hybrid into annular and total segments', () => {
    const segs = centralSegments(computePath(get('2023-04-20').elements).central)
    const kinds = segs.map((s) => s.kind)
    expect(kinds).toContain('A')
    expect(kinds).toContain('T')
  })
})

describe('polar path (2021 Jun 10)', () => {
  it('has no path quads spanning a huge longitude range', () => {
    const p = computePath(get('2021-06-10').elements)
    for (const ring of p.polygons) {
      const lons = ring.map((q) => q[0])
      expect(Math.max(...lons) - Math.min(...lons)).toBeLessThan(90)
    }
  })
})

describe('shadow outlines and partial zone', () => {
  const e = get('2027-02-06').elements
  it('penumbra touches the Earth for ~6 hours', () => {
    const [a, b] = contactRange(e, 'penumbra')!
    expect(b - a).toBeGreaterThan(5.5)
    expect(b - a).toBeLessThan(6.5)
  })

  it('outlines are closed rings', () => {
    for (const t of [-2.5, 0, 2.5]) {
      const ring = shadowOutline(e, t, 'penumbra')!
      expect(ring[0]).toEqual(ring[ring.length - 1])
    }
    expect(shadowOutline(e, 0, 'umbra')!.length).toBeGreaterThan(100)
  })

  it('computes a visibility zone and isolines', () => {
    const z = computePartialZone(e, 2, 5)
    expect(z.zone.length).toBeGreaterThan(0)
    expect(z.isolines.every((i) => i.lines.length > 0)).toBe(true)
  })
})
