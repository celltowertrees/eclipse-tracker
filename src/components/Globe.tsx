import * as maplibregl from 'maplibre-gl'
import type { GeoJSONSource, Map as MLMap } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
// Bundle MapLibre's tile worker (and its shared chunk) as a proper worker entry.
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { useEffect, useRef } from 'react'
import type { EclipseSummary } from '../astro/catalog'
import { normLon } from '../astro/earth'
import { shadowCenter, shadowOutline, terminator } from '../astro/shadow'
import { PARTIAL_COLOR, PATH_COLOR } from '../lib/colors'
import type { EclipseGeometry } from '../lib/geometry'
import { useStore } from '../store'

maplibregl.setWorkerUrl(maplibreWorkerUrl)

type FC = GeoJSON.FeatureCollection
const empty: FC = { type: 'FeatureCollection', features: [] }
const STYLE = 'https://tiles.openfreemap.org/styles/liberty'


const SOURCES = ['zone', 'zone-lines', 'path', 'limits', 'central', 'greatest', 'cities', 'penumbra', 'umbra', 'terminator', 'axis'] as const

function fc(features: GeoJSON.Feature[]): FC {
  return { type: 'FeatureCollection', features }
}
const line = (coordinates: number[][], properties: GeoJSON.GeoJsonProperties = {}): GeoJSON.Feature => ({
  type: 'Feature',
  properties,
  geometry: { type: 'LineString', coordinates },
})

function addLayers(map: MLMap) {
  for (const id of SOURCES) map.addSource(id, { type: 'geojson', data: empty })
  // Draw fills and lines beneath the base map's labels.
  const beforeId = map.getStyle().layers.find((l) => l.type === 'symbol')?.id

  map.addLayer({ id: 'zone-fill', type: 'fill', source: 'zone', paint: { 'fill-color': PARTIAL_COLOR, 'fill-opacity': 0.08 } }, beforeId)
  map.addLayer({ id: 'penumbra-fill', type: 'fill', source: 'penumbra', paint: { 'fill-color': '#0a0d1a', 'fill-opacity': 0.28 } }, beforeId)
  map.addLayer({ id: 'penumbra-line', type: 'line', source: 'penumbra', paint: { 'line-color': '#1b2240', 'line-width': 1, 'line-opacity': 0.6 } }, beforeId)
  map.addLayer(
    {
      id: 'zone-outline',
      type: 'line',
      source: 'zone-lines',
      filter: ['==', ['get', 'kind'], 'outline'],
      paint: { 'line-color': PARTIAL_COLOR, 'line-width': 2.2, 'line-opacity': 1 },
    },
    beforeId,
  )
  map.addLayer(
    {
      id: 'isolines',
      type: 'line',
      source: 'zone-lines',
      filter: ['==', ['get', 'kind'], 'iso'],
      paint: { 'line-color': PARTIAL_COLOR, 'line-width': 2, 'line-dasharray': [1, 2], 'line-opacity': 0.95 },
    },
    beforeId,
  )
  map.addLayer({ id: 'path-fill', type: 'fill', source: 'path', paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.28, 'fill-antialias': false } }, beforeId)
  map.addLayer({ id: 'limits', type: 'line', source: 'limits', paint: { 'line-color': ['get', 'color'], 'line-width': 2.2 } }, beforeId)
  map.addLayer(
    {
      id: 'central',
      type: 'line',
      source: 'central',
      paint: { 'line-color': ['get', 'color'], 'line-width': 1.4, 'line-dasharray': [4, 3], 'line-opacity': 0.9 },
    },
    beforeId,
  )
  map.addLayer({ id: 'umbra-fill', type: 'fill', source: 'umbra', paint: { 'fill-color': '#05060d', 'fill-opacity': 0.75 } }, beforeId)
  map.addLayer(
    {
      id: 'terminator',
      type: 'line',
      source: 'terminator',
      paint: { 'line-color': '#ffd27a', 'line-width': 1, 'line-opacity': 0.55, 'line-dasharray': [2, 2] },
    },
    beforeId,
  )

  // Labels and markers on top.
  map.addLayer({
    id: 'isoline-labels',
    type: 'symbol',
    source: 'zone-lines',
    filter: ['==', ['get', 'kind'], 'iso'],
    layout: {
      'symbol-placement': 'line',
      'symbol-spacing': 350,
      'text-field': ['get', 'label'],
      'text-font': ['Noto Sans Regular'],
      'text-size': 12,
    },
    paint: { 'text-color': '#ffffff', 'text-halo-color': PARTIAL_COLOR, 'text-halo-width': 1.5 },
  })
  map.addLayer({
    id: 'axis',
    type: 'circle',
    source: 'axis',
    paint: { 'circle-radius': 4, 'circle-color': '#ffffff', 'circle-stroke-color': '#05060d', 'circle-stroke-width': 2 },
  })
  map.addLayer({
    id: 'greatest',
    type: 'circle',
    source: 'greatest',
    paint: {
      'circle-radius': 7,
      'circle-color': 'rgba(0,0,0,0)',
      'circle-stroke-color': '#ffe08a',
      'circle-stroke-width': 2.5,
    },
  })
  map.addLayer({
    id: 'greatest-label',
    type: 'symbol',
    source: 'greatest',
    layout: {
      'text-field': 'Greatest eclipse',
      'text-font': ['Noto Sans Bold'],
      'text-size': 11,
      'text-offset': [0, -1.4],
      'text-anchor': 'bottom',
      'text-allow-overlap': true,
    },
    paint: { 'text-color': '#ffe08a', 'text-halo-color': '#0b0f1a', 'text-halo-width': 1.6 },
  })
  map.addLayer({
    id: 'cities',
    type: 'circle',
    source: 'cities',
    paint: { 'circle-radius': 5, 'circle-color': '#ffffff', 'circle-stroke-color': '#0b0f1a', 'circle-stroke-width': 2 },
  })
  map.addLayer({
    id: 'city-labels',
    type: 'symbol',
    source: 'cities',
    layout: {
      'text-field': ['get', 'name'],
      'text-font': ['Noto Sans Bold'],
      'text-size': 12,
      'text-offset': [0, 1.1],
      'text-anchor': 'top',
    },
    paint: { 'text-color': '#ffffff', 'text-halo-color': '#0b0f1a', 'text-halo-width': 1.6 },
  })
}

function setData(map: MLMap, id: (typeof SOURCES)[number], data: FC) {
  ;(map.getSource(id) as GeoJSONSource | undefined)?.setData(data)
}

function renderEclipse(map: MLMap, e: EclipseSummary | null, g: EclipseGeometry | null) {
  const color = e ? PATH_COLOR[e.kind] : '#fff'
  setData(
    map,
    'greatest',
    e ? fc([{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [e.greatest.lon, e.greatest.lat] } }]) : empty,
  )
  setData(
    map,
    'cities',
    fc(
      (e?.cities ?? []).map((c) => ({
        type: 'Feature',
        properties: { name: c.name, country: c.country },
        geometry: { type: 'Point', coordinates: [c.lon, c.lat] },
      })),
    ),
  )
  if (!g) {
    for (const id of ['zone', 'zone-lines', 'path', 'limits', 'central'] as const) setData(map, id, empty)
    return
  }
  setData(
    map,
    'zone',
    fc(g.partial.zone.map((coordinates) => ({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates } }))),
  )
  setData(
    map,
    'zone-lines',
    fc([
      ...g.partial.outline.map((l) => line(l, { kind: 'outline' })),
      ...g.partial.isolines.flatMap((iso) => iso.lines.map((l) => line(l, { kind: 'iso', label: iso.magnitude.toFixed(1) }))),
    ]),
  )
  setData(
    map,
    'path',
    fc([{ type: 'Feature', properties: { color }, geometry: { type: 'MultiPolygon', coordinates: g.polygons.map((ring) => [ring]) } }]),
  )
  setData(map, 'limits', fc([...g.north, ...g.south].map((l) => line(l, { color }))))
  setData(map, 'central', fc(g.central.map((s) => line(s.coords, { color: PATH_COLOR[s.kind] }))))
}

function renderShadow(map: MLMap, e: EclipseSummary | null, t: number) {
  if (!e) return
  const poly = (ring: number[][] | null): FC =>
    ring ? fc([{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } }]) : empty
  setData(map, 'penumbra', poly(shadowOutline(e.elements, t, 'penumbra')))
  setData(map, 'umbra', poly(shadowOutline(e.elements, t, 'umbra')))
  setData(map, 'terminator', fc([line(terminator(e.elements, t))]))
  const c = shadowCenter(e.elements, t)
  setData(map, 'axis', c ? fc([{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: c } }]) : empty)
}

/** Whole-globe zooms are tuned for a ~900px-wide view; shrink them on small screens. */
function fitZoom(map: MLMap, zoom: number): number {
  if (zoom > 3) return zoom
  const size = Math.min(map.getContainer().clientWidth, map.getContainer().clientHeight)
  return Math.max(0.2, zoom + Math.log2(Math.min(1, size / 700)))
}

export default function Globe() {
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const map = new maplibregl.Map({
      container: container.current!,
      style: STYLE,
      center: [0, 20],
      zoom: 1.4,
      attributionControl: { compact: true },
    })
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right')
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'top-left')

    if (import.meta.env.DEV) (window as unknown as { __map: MLMap }).__map = map
    let ready = false
    const pinMarker = new maplibregl.Marker({ color: '#ffe08a' })

    map.on('style.load', () => {
      map.setProjection({ type: 'globe' })
      map.setSky({
        'sky-color': '#0b1026',
        'horizon-color': '#27406b',
        'fog-color': '#0b1026',
        'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0],
      })
      addLayers(map)
      ready = true
      const s = useStore.getState()
      renderEclipse(map, s.selected, s.geometry)
      renderShadow(map, s.selected, s.t)
    })

    map.on('click', (ev) => {
      const city = map.queryRenderedFeatures(ev.point, { layers: ['cities'] })[0]
      if (city && city.geometry.type === 'Point') {
        const [lon, lat] = city.geometry.coordinates
        useStore.getState().setPin({ lat, lon, label: `${city.properties.name}, ${city.properties.country}` })
      } else {
        useStore.getState().setPin({ lat: ev.lngLat.lat, lon: normLon(ev.lngLat.lng) })
      }
    })
    map.on('mouseenter', 'cities', () => (map.getCanvas().style.cursor = 'pointer'))
    map.on('mouseleave', 'cities', () => (map.getCanvas().style.cursor = ''))

    const unsub = useStore.subscribe((s, prev) => {
      if (ready && (s.selected !== prev.selected || s.geometry !== prev.geometry)) renderEclipse(map, s.selected, s.geometry)
      if (ready && (s.t !== prev.t || s.selected !== prev.selected)) renderShadow(map, s.selected, s.t)
      if (s.fly && s.fly !== prev.fly) {
        map.flyTo({ center: [s.fly.lon, s.fly.lat], zoom: fitZoom(map, s.fly.zoom), speed: 1.2, essential: true })
      }
      if (s.pin !== prev.pin) {
        if (s.pin) pinMarker.setLngLat([s.pin.lon, s.pin.lat]).addTo(map)
        else pinMarker.remove()
      }
    })
    const initial = useStore.getState().fly
    if (initial) map.jumpTo({ center: [initial.lon, initial.lat], zoom: fitZoom(map, initial.zoom) })

    return () => {
      unsub()
      map.remove()
    }
  }, [])

  return <div ref={container} className="globe" />
}
