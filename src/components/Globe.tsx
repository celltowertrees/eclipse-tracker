import * as maplibregl from 'maplibre-gl'
import type { ExpressionSpecification, GeoJSONSource, Map as MLMap } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
// Bundle MapLibre's tile worker (and its shared chunk) as a proper worker entry.
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { useEffect, useRef } from 'react'
import type { EclipseSummary } from '../astro/catalog'
import { normLon } from '../astro/earth'
import { shadowCenter, shadowOutline, terminator } from '../astro/shadow'
import type { EclipseGeometry } from '../lib/geometry'
import { onColorSchemeChange, readMapTheme, type MapTheme } from '../lib/theme'
import { useStore } from '../store'

maplibregl.setWorkerUrl(maplibreWorkerUrl)

type FC = GeoJSON.FeatureCollection
const empty: FC = { type: 'FeatureCollection', features: [] }

const SOURCES = ['zone', 'zone-lines', 'path', 'limits', 'central', 'greatest', 'cities', 'penumbra', 'umbra', 'terminator', 'axis'] as const

function fc(features: GeoJSON.Feature[]): FC {
  return { type: 'FeatureCollection', features }
}
const line = (coordinates: number[][], properties: GeoJSON.GeoJsonProperties = {}): GeoJSON.Feature => ({
  type: 'Feature',
  properties,
  geometry: { type: 'LineString', coordinates },
})

/** Color by the feature's eclipse kind ('T' | 'A' | 'H'). */
function kindColor(th: MapTheme): ExpressionSpecification {
  return ['match', ['get', 'kind'], 'T', th.total, 'A', th.annular, th.hybrid]
}

function addLayers(map: MLMap, th: MapTheme) {
  for (const id of SOURCES) map.addSource(id, { type: 'geojson', data: empty })
  // Draw fills and lines beneath the base map's labels.
  const beforeId = map.getStyle().layers.find((l) => l.type === 'symbol')?.id
  const font = [th.font]

  map.addLayer({ id: 'zone-fill', type: 'fill', source: 'zone', paint: { 'fill-color': th.partial, 'fill-opacity': th.zoneOpacity } }, beforeId)
  map.addLayer(
    { id: 'penumbra-fill', type: 'fill', source: 'penumbra', paint: { 'fill-color': th.penumbra, 'fill-opacity': th.penumbraOpacity } },
    beforeId,
  )
  map.addLayer(
    {
      id: 'zone-outline',
      type: 'line',
      source: 'zone-lines',
      filter: ['==', ['get', 'kind'], 'outline'],
      paint: { 'line-color': th.partial, 'line-width': th.zoneLineWidth },
    },
    beforeId,
  )
  map.addLayer(
    {
      id: 'isolines',
      type: 'line',
      source: 'zone-lines',
      filter: ['==', ['get', 'kind'], 'iso'],
      paint: { 'line-color': th.partial, 'line-width': th.isolineWidth, 'line-dasharray': [1, 2] },
    },
    beforeId,
  )
  map.addLayer(
    {
      id: 'path-fill',
      type: 'fill',
      source: 'path',
      paint: { 'fill-color': kindColor(th), 'fill-opacity': th.pathOpacity, 'fill-antialias': false },
    },
    beforeId,
  )
  map.addLayer({ id: 'limits', type: 'line', source: 'limits', paint: { 'line-color': kindColor(th), 'line-width': th.limitWidth } }, beforeId)
  map.addLayer(
    {
      id: 'central',
      type: 'line',
      source: 'central',
      paint: { 'line-color': kindColor(th), 'line-width': th.centralWidth, 'line-dasharray': [4, 3] },
    },
    beforeId,
  )
  map.addLayer({ id: 'umbra-fill', type: 'fill', source: 'umbra', paint: { 'fill-color': th.umbra, 'fill-opacity': th.umbraOpacity } }, beforeId)
  map.addLayer(
    {
      id: 'terminator',
      type: 'line',
      source: 'terminator',
      paint: { 'line-color': th.terminator, 'line-width': 1, 'line-dasharray': [2, 2] },
    },
    beforeId,
  )

  // Labels and markers on top.
  map.addLayer({
    id: 'isoline-labels',
    type: 'symbol',
    source: 'zone-lines',
    filter: ['==', ['get', 'kind'], 'iso'],
    layout: { 'symbol-placement': 'line', 'symbol-spacing': 350, 'text-field': ['get', 'label'], 'text-font': font, 'text-size': 12 },
    paint: { 'text-color': th.partial, 'text-halo-color': th.labelHalo, 'text-halo-width': 1.5 },
  })
  map.addLayer({
    id: 'axis',
    type: 'circle',
    source: 'axis',
    paint: { 'circle-radius': 4, 'circle-color': th.marker, 'circle-stroke-color': th.markerStroke, 'circle-stroke-width': 2 },
  })
  map.addLayer({
    id: 'greatest',
    type: 'circle',
    source: 'greatest',
    paint: { 'circle-radius': 7, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': th.greatest, 'circle-stroke-width': 2.5 },
  })
  map.addLayer({
    id: 'greatest-label',
    type: 'symbol',
    source: 'greatest',
    layout: {
      'text-field': 'Greatest eclipse',
      'text-font': font,
      'text-size': 11,
      'text-offset': [0, -1.4],
      'text-anchor': 'bottom',
      'text-allow-overlap': true,
    },
    paint: { 'text-color': th.greatest, 'text-halo-color': th.labelHalo, 'text-halo-width': 1.6 },
  })
  map.addLayer({
    id: 'cities',
    type: 'circle',
    source: 'cities',
    paint: { 'circle-radius': 5, 'circle-color': th.marker, 'circle-stroke-color': th.markerStroke, 'circle-stroke-width': 2 },
  })
  map.addLayer({
    id: 'city-labels',
    type: 'symbol',
    source: 'cities',
    layout: { 'text-field': ['get', 'name'], 'text-font': font, 'text-size': 12, 'text-offset': [0, 1.1], 'text-anchor': 'top' },
    paint: { 'text-color': th.label, 'text-halo-color': th.labelHalo, 'text-halo-width': 1.6 },
  })
}

function setData(map: MLMap, id: (typeof SOURCES)[number], data: FC) {
  ;(map.getSource(id) as GeoJSONSource | undefined)?.setData(data)
}

function renderEclipse(map: MLMap, e: EclipseSummary | null, g: EclipseGeometry | null) {
  const kind = e?.kind ?? 'T'
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
    fc([{ type: 'Feature', properties: { kind }, geometry: { type: 'MultiPolygon', coordinates: g.polygons.map((ring) => [ring]) } }]),
  )
  setData(map, 'limits', fc([...g.north, ...g.south].map((l) => line(l, { kind }))))
  setData(map, 'central', fc(g.central.map((s) => line(s.coords, { kind: s.kind }))))
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
    let theme = readMapTheme()
    const map = new maplibregl.Map({
      container: container.current!,
      style: theme.style,
      center: [0, 20],
      zoom: 1.4,
      attributionControl: { compact: true },
    })
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right')
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'top-left')

    if (import.meta.env.DEV) (window as unknown as { __map: MLMap }).__map = map
    let ready = false
    const pinEl = document.createElement('div')
    pinEl.className = 'pin-marker'
    const pinMarker = new maplibregl.Marker({ element: pinEl })

    // Fires on first load and after every setStyle (e.g. a light/dark switch).
    map.on('style.load', () => {
      map.setProjection({ type: 'globe' })
      map.setSky({
        'sky-color': theme.sky,
        'horizon-color': theme.horizon,
        'fog-color': theme.sky,
        'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 1, 5, 1, 7, 0],
      })
      addLayers(map, theme)
      ready = true
      const s = useStore.getState()
      renderEclipse(map, s.selected, s.geometry)
      renderShadow(map, s.selected, s.t)
    })

    const offScheme = onColorSchemeChange(() => {
      theme = readMapTheme()
      ready = false
      map.setStyle(theme.style, { diff: false })
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
      offScheme()
      map.remove()
    }
  }, [])

  return <div ref={container} className="globe" />
}
