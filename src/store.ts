import { create } from 'zustand'
import type { Catalog, EclipseSummary } from './astro/catalog'
import { utcMsToT } from './astro/besselian'
import { loadGeometry, type EclipseGeometry } from './lib/geometry'

export interface Pin {
  lat: number
  lon: number
  label?: string
}

export interface FlyTarget {
  lat: number
  lon: number
  zoom: number
  nonce: number
}

interface State {
  catalog: Catalog | null
  selected: EclipseSummary | null
  geometry: EclipseGeometry | null
  loading: boolean
  /** Animation time, hours from t0 */
  t: number
  playing: boolean
  /** Simulated seconds per real second */
  speed: number
  pin: Pin | null
  fly: FlyTarget | null

  init: () => Promise<void>
  select: (id: string) => Promise<void>
  setT: (t: number) => void
  setPlaying: (p: boolean) => void
  setSpeed: (s: number) => void
  setPin: (p: Pin | null) => void
  flyTo: (lat: number, lon: number, zoom?: number) => void
}

function defaultId(c: Catalog): string {
  const fromHash = decodeURIComponent(location.hash.slice(1))
  if (c.eclipses.some((e) => e.id === fromHash)) return fromHash
  const now = Date.now()
  return (c.eclipses.find((e) => Date.parse(e.greatest.utc) > now) ?? c.eclipses[c.eclipses.length - 1]).id
}

let initStarted = false

export const useStore = create<State>((set, get) => ({
  catalog: null,
  selected: null,
  geometry: null,
  loading: false,
  t: 0,
  playing: false,
  speed: 600,
  pin: null,
  fly: null,

  init: async () => {
    if (initStarted) return
    initStarted = true
    const res = await fetch(`${import.meta.env.BASE_URL}data/catalog.json`)
    const catalog = (await res.json()) as Catalog
    set({ catalog })
    window.addEventListener('hashchange', () => {
      const id = decodeURIComponent(location.hash.slice(1))
      if (id && id !== get().selected?.id) void get().select(id)
    })
    await get().select(defaultId(catalog))
  },

  select: async (id) => {
    const e = get().catalog?.eclipses.find((x) => x.id === id)
    if (!e) return
    if (location.hash.slice(1) !== id) history.replaceState(null, '', `#${id}`)
    const tGreatest = utcMsToT(e.elements, Date.parse(e.greatest.utc))
    set({ selected: e, geometry: null, loading: true, playing: false, pin: null, t: tGreatest })
    get().flyTo(e.greatest.lat, e.greatest.lon, 1.6)
    const geometry = await loadGeometry(id, e.elements)
    if (get().selected?.id === id) set({ geometry, loading: false })
  },

  setT: (t) => set({ t }),
  setPlaying: (playing) => set({ playing }),
  setSpeed: (speed) => set({ speed }),
  setPin: (pin) => set({ pin }),
  flyTo: (lat, lon, zoom = 5) => set({ fly: { lat, lon, zoom, nonce: Math.random() } }),
}))
