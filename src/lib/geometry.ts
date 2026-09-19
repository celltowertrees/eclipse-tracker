import type { BesselianElements } from '../astro/besselian'
import { haversineKm } from '../astro/earth'
import type { LonLat } from '../astro/geo'
import type { PartialZone } from '../astro/partialZone'
import type { WorkerRequest, WorkerResponse } from '../workers/eclipse.worker'

export interface EclipseGeometry {
  /** Hours from t0 during which the penumbra / umbra touch the Earth */
  penumbraRange: [number, number] | null
  umbraRange: [number, number] | null
  central: { kind: 'T' | 'A'; coords: LonLat[] }[]
  north: LonLat[][]
  south: LonLat[][]
  polygons: LonLat[][]
  partial: PartialZone
}

const cache = new Map<string, Promise<EclipseGeometry>>()
let worker: Worker | null = null
const pending = new Map<string, (g: EclipseGeometry) => void>()

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../workers/eclipse.worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (ev: MessageEvent<WorkerResponse>) => {
      pending.get(ev.data.id)?.(ev.data.geometry)
      pending.delete(ev.data.id)
    }
  }
  return worker
}

/** Compute (or fetch from cache) the path and visibility geometry for an eclipse. */
export function loadGeometry(id: string, elements: BesselianElements): Promise<EclipseGeometry> {
  let p = cache.get(id)
  if (!p) {
    p = new Promise((resolve) => {
      pending.set(id, resolve)
      const req: WorkerRequest = { id, elements }
      getWorker().postMessage(req)
    })
    cache.set(id, p)
  }
  return p
}

/** Distance in km from a point to the nearest point on the path limits. */
export function distanceToPathKm(g: EclipseGeometry, lat: number, lon: number): number | null {
  let best = Infinity
  for (const line of [...g.north, ...g.south]) {
    for (const [plon, plat] of line) best = Math.min(best, haversineKm(lat, lon, plat, plon))
  }
  return Number.isFinite(best) ? best : null
}
