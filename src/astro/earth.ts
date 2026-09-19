// Conversions between the fundamental plane and geodetic coordinates on the
// Earth ellipsoid (Explanatory Supplement to the Astronomical Almanac, ch. 8).

import type { ElementsAt } from './besselian'

export const E2 = 0.00669438 // eccentricity² of the Earth ellipsoid
export const B_A = Math.sqrt(1 - E2) // polar/equatorial axis ratio ≈ 0.99664719
const EQUATORIAL_RADIUS_M = 6378137
const RAD = Math.PI / 180
const DEG = 180 / Math.PI

/** Longitude correction (degrees) from the ephemeris meridian to the UT-based meridian. */
export function ephemerisLonCorrection(deltaT: number): number {
  return 0.00417807 * deltaT
}

export function normLon(lon: number): number {
  return ((((lon + 180) % 360) + 360) % 360) - 180
}

export interface Ellipsoid {
  rho1: number
  rho2: number
  sd1: number
  cd1: number
  sdd: number // sin(d1 − d2)
  cdd: number // cos(d1 − d2)
}

export function ellipsoidFor(E: ElementsAt): Ellipsoid {
  const sd = Math.sin(E.d)
  const cd = Math.cos(E.d)
  const rho1 = Math.sqrt(1 - E2 * cd * cd)
  const rho2 = Math.sqrt(1 - E2 * sd * sd)
  return {
    rho1,
    rho2,
    sd1: sd / rho1,
    cd1: (B_A * cd) / rho1,
    sdd: (E2 * sd * cd) / (rho1 * rho2),
    cdd: B_A / (rho1 * rho2),
  }
}

export interface GeoPoint {
  lat: number
  lon: number
  /** ζ: distance from the fundamental plane (≈ sin of the Sun's altitude) */
  zeta: number
}

/** Point (ξ, η₁, ζ₁) on the unit sphere of the scaled Earth → geodetic lat/lon. */
export function scaledToGeo(E: ElementsAt, el: Ellipsoid, xi: number, eta1: number, zeta1: number, deltaT: number): GeoPoint {
  const B = zeta1 * el.cd1 - eta1 * el.sd1
  const sinPhi1 = eta1 * el.cd1 + zeta1 * el.sd1
  const theta = Math.atan2(xi, B)
  const phi1 = Math.asin(Math.max(-1, Math.min(1, sinPhi1)))
  const lat = Math.atan(Math.tan(phi1) / B_A) * DEG
  const lon = normLon((theta - E.mu) * DEG + ephemerisLonCorrection(deltaT))
  const zeta = el.rho2 * (zeta1 * el.cdd - eta1 * el.sdd)
  return { lat, lon, zeta }
}

/** Fundamental-plane point (ξ, η) → surface point on the sunward hemisphere, or null if off the Earth. */
export function fundamentalToGeo(E: ElementsAt, el: Ellipsoid, xi: number, eta: number, deltaT: number): GeoPoint | null {
  const eta1 = eta / el.rho1
  const s = 1 - xi * xi - eta1 * eta1
  if (s < 0) return null
  return scaledToGeo(E, el, xi, eta1, Math.sqrt(s), deltaT)
}

/** ζ at fundamental-plane point (ξ, η), or null if off the Earth. */
export function zetaAt(el: Ellipsoid, xi: number, eta: number): number | null {
  const eta1 = eta / el.rho1
  const s = 1 - xi * xi - eta1 * eta1
  if (s < 0) return null
  return el.rho2 * (Math.sqrt(s) * el.cdd - eta1 * el.sdd)
}

export interface Observer {
  lat: number
  lon: number
  rhoSinPhi: number
  rhoCosPhi: number
}

export function makeObserver(lat: number, lon: number, heightM = 0): Observer {
  const phi = lat * RAD
  const u = Math.atan(B_A * Math.tan(phi))
  const h = heightM / EQUATORIAL_RADIUS_M
  return {
    lat,
    lon,
    rhoSinPhi: B_A * Math.sin(u) + h * Math.sin(phi),
    rhoCosPhi: Math.cos(u) + h * Math.cos(phi),
  }
}

export interface ObserverFundamental {
  xi: number
  eta: number
  zeta: number
  dxi: number
  deta: number
  /** local hour angle of the shadow axis, radians */
  H: number
}

export function observerFundamental(E: ElementsAt, o: Observer, deltaT: number): ObserverFundamental {
  const H = E.mu + (o.lon - ephemerisLonCorrection(deltaT)) * RAD
  const sH = Math.sin(H)
  const cH = Math.cos(H)
  const sd = Math.sin(E.d)
  const cd = Math.cos(E.d)
  const xi = o.rhoCosPhi * sH
  const eta = o.rhoSinPhi * cd - o.rhoCosPhi * cH * sd
  const zeta = o.rhoSinPhi * sd + o.rhoCosPhi * cH * cd
  const dxi = E.dmu * o.rhoCosPhi * cH
  const deta = E.dmu * xi * sd - zeta * E.dd
  return { xi, eta, zeta, dxi, deta, H }
}

/** Great-circle distance in km. */
export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = (lat2 - lat1) * RAD
  const dLon = (lon2 - lon1) * RAD
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLon / 2) ** 2
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(a)))
}
