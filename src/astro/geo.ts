export type LonLat = [number, number]

/** Make longitudes continuous along a line so it doesn't jump across the antimeridian. */
export function unwrapLons(coords: LonLat[]): LonLat[] {
  const out: LonLat[] = []
  for (const [lon0, lat] of coords) {
    let lon = lon0
    if (out.length) {
      const prev = out[out.length - 1][0]
      while (lon - prev > 180) lon -= 360
      while (lon - prev < -180) lon += 360
    }
    out.push([lon, lat])
  }
  return out
}

/**
 * Close a ring for GeoJSON. If the unwrapped ring winds around a pole, route it
 * through that pole so the polygon covers the polar cap instead of a sliver.
 */
export function closeRing(coords: LonLat[]): LonLat[] {
  const ring = unwrapLons(coords)
  if (ring.length < 3) return ring
  const first = ring[0]
  const last = ring[ring.length - 1]
  const winding = last[0] - first[0]
  if (Math.abs(winding) > 180) {
    const meanLat = ring.reduce((s, p) => s + p[1], 0) / ring.length
    const pole = meanLat >= 0 ? 90 : -90
    ring.push([last[0], pole], [first[0], pole])
  }
  ring.push([ring[0][0], ring[0][1]])
  return ring
}
