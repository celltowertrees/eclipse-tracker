/// <reference lib="webworker" />
import type { BesselianElements } from '../astro/besselian'
import { centralSegments, computePath } from '../astro/path'
import { computePartialZone } from '../astro/partialZone'
import { contactRange } from '../astro/shadow'
import type { EclipseGeometry } from '../lib/geometry'

export interface WorkerRequest {
  id: string
  elements: BesselianElements
}

export interface WorkerResponse {
  id: string
  geometry: EclipseGeometry
  ms: number
}

self.onmessage = (ev: MessageEvent<WorkerRequest>) => {
  const start = performance.now()
  const { id, elements } = ev.data
  const path = computePath(elements)
  const geometry: EclipseGeometry = {
    penumbraRange: contactRange(elements, 'penumbra'),
    umbraRange: contactRange(elements, 'umbra'),
    central: centralSegments(path.central),
    north: path.north,
    south: path.south,
    polygons: path.polygons,
    partial: computePartialZone(elements),
  }
  const res: WorkerResponse = { id, geometry, ms: performance.now() - start }
  self.postMessage(res)
}
